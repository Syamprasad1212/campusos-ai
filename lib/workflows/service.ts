import { db } from '@/lib/db';
import { WORKFLOW_DEFINITIONS } from './definitions';
import { notifyWorkflowEvent, WorkflowEventType } from '@/lib/notifications/service';
import {
  WorkflowDefinition,
  ValidationResult,
  ValidationError,
  CreateRequestInput,
  RequestStatus,
  TimelineEvent,
} from '@/types';

// State machine transition map enforcing valid workflow lifecycle progression
export const ALLOWED_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['VALIDATING', 'AI_PROCESSING', 'ROUTED', 'UNDER_REVIEW', 'CANCELLED'],
  AI_PROCESSING: ['INFORMATION_REQUIRED', 'VALIDATING', 'ROUTED'],
  INFORMATION_REQUIRED: ['SUBMITTED', 'UNDER_REVIEW', 'CANCELLED'],
  VALIDATING: ['ROUTED', 'INFORMATION_REQUIRED', 'REJECTED'],
  ROUTED: ['ASSIGNED', 'UNDER_REVIEW'],
  ASSIGNED: ['UNDER_REVIEW', 'IN_PROGRESS'],
  UNDER_REVIEW: ['APPROVAL_PENDING', 'APPROVED', 'REJECTED', 'INFORMATION_REQUIRED', 'IN_PROGRESS', 'RESOLVED', 'COMPLETED'],
  APPROVAL_PENDING: ['APPROVED', 'REJECTED', 'INFORMATION_REQUIRED', 'COMPLETED'],
  APPROVED: ['IN_PROGRESS', 'RESOLVED', 'COMPLETED'],
  IN_PROGRESS: ['RESOLVED', 'COMPLETED', 'INFORMATION_REQUIRED'],
  RESOLVED: ['COMPLETED'],
  REJECTED: ['CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionStatus(from: RequestStatus, to: RequestStatus): boolean {
  if (from === to) return true;
  const allowed = ALLOWED_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export function getWorkflowByKey(key: string): WorkflowDefinition | undefined {
  return WORKFLOW_DEFINITIONS.find((wf) => wf.key === key);
}

export function listActiveWorkflows(): WorkflowDefinition[] {
  return WORKFLOW_DEFINITIONS;
}

/**
 * Validate incoming request payload against workflow field definitions
 */
export function validateWorkflowData(
  workflow: WorkflowDefinition,
  data: Record<string, unknown>
): ValidationResult {
  const errors: ValidationError[] = [];

  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      errors: [{ field: '_root', message: 'Request data payload must be a valid JSON object' }],
    };
  }

  for (const field of workflow.requiredFields) {
    const val = data[field.key];

    if (field.required && (val === undefined || val === null || val === '')) {
      errors.push({ field: field.key, message: `Field "${field.label}" is required` });
      continue;
    }

    if (val !== undefined && val !== null && val !== '') {
      if (field.type === 'number') {
        const num = Number(val);
        if (isNaN(num)) {
          errors.push({ field: field.key, message: `Field "${field.label}" must be a valid number` });
        }
      } else if (field.type === 'date') {
        const date = new Date(String(val));
        if (isNaN(date.getTime())) {
          errors.push({ field: field.key, message: `Field "${field.label}" must be a valid date string` });
        }
      } else if (field.type === 'select' && field.options) {
        if (!field.options.includes(String(val))) {
          errors.push({
            field: field.key,
            message: `Field "${field.label}" value must be one of: ${field.options.join(', ')}`,
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Transaction-safe workflow request creation
 */
export async function createWorkflowRequest(input: CreateRequestInput) {
  const { requesterId, workflowKey, title, summary, data } = input;

  const wfDef = getWorkflowByKey(workflowKey);
  if (!wfDef) {
    throw new Error(`[WORKFLOW_NOT_FOUND] Workflow with key "${workflowKey}" does not exist.`);
  }

  const validation = validateWorkflowData(wfDef, data);
  if (!validation.valid) {
    const errorMsg = validation.errors.map((e) => `${e.field}: ${e.message}`).join('; ');
    throw new Error(`[VALIDATION_FAILED] Request data validation failed: ${errorMsg}`);
  }

  const newReq = await db.$transaction(
    async (tx) => {
    const user = await tx.user.findUnique({ where: { id: requesterId } });
    if (!user) {
      throw new Error(`[USER_NOT_FOUND] User with ID "${requesterId}" does not exist.`);
    }

    let department = await tx.department.findFirst({
      where: { code: wfDef.departmentCode },
    });

    if (!department) {
      department = await tx.department.create({
        data: {
          code: wfDef.departmentCode,
          name: `${wfDef.departmentCode} Department`,
          description: `Automatically created department for ${wfDef.departmentCode}`,
        },
      });
    }

    let dbWorkflow = await tx.workflow.findUnique({
      where: { key: wfDef.key },
    });

    if (!dbWorkflow) {
      dbWorkflow = await tx.workflow.create({
        data: {
          key: wfDef.key,
          name: wfDef.title,
          title: wfDef.title,
          description: wfDef.description,
          category: wfDef.category,
          pattern: wfDef.pattern,
          departmentId: department.id,
          configJson: JSON.parse(JSON.stringify(wfDef)),
        },
      });

      for (const step of wfDef.stepSequence) {
        await tx.workflowStep.create({
          data: {
            workflowId: dbWorkflow.id,
            stepOrder: step.stepOrder,
            name: step.name,
            description: step.description,
            roleRequired: step.roleRequired,
            requiresApproval: step.requiresApproval || false,
            requiresDocuments: step.requiresDocuments || false,
          },
        });
      }
    }

    const firstStepDef = wfDef.stepSequence[0];

    const request = await tx.request.create({
      data: {
        studentId: user.id,
        workflowId: dbWorkflow.id,
        departmentId: department.id,
        title: title || wfDef.title,
        summary: summary || wfDef.description,
        status: 'SUBMITTED',
        currentStep: 1,
      },
    });

    await tx.requestData.create({
      data: {
        requestId: request.id,
        formData: JSON.parse(JSON.stringify(data)),
      },
    });

    if (firstStepDef) {
      const dbStep = await tx.workflowStep.findUnique({
        where: {
          workflowId_stepOrder: {
            workflowId: dbWorkflow.id,
            stepOrder: 1,
          },
        },
      });

      await tx.task.create({
        data: {
          requestId: request.id,
          stepId: dbStep?.id,
          title: `${firstStepDef.name}: ${request.title}`,
          description: firstStepDef.description,
          status: 'PENDING',
        },
      });

      if (firstStepDef.requiresApproval) {
        await tx.approval.create({
          data: {
            requestId: request.id,
            stepOrder: 1,
            status: 'PENDING',
            idempotencyKey: `${request.id}:step-1:approval`,
          },
        });
      }
    }

    await tx.auditLog.create({
      data: {
        requestId: request.id,
        actorId: user.id,
        action: 'REQUEST_CREATED',
        metadata: JSON.parse(JSON.stringify({ workflowKey, title, departmentCode: wfDef.departmentCode })),
        details: JSON.parse(JSON.stringify({ status: 'SUBMITTED', currentStep: 1 })),
      },
    });

    return request;
  }, { maxWait: 15000, timeout: 25000 });

  // Post-Transaction Non-Blocking Notification Side Effect
  notifyWorkflowEvent({
    eventType: 'REQUEST_SUBMITTED',
    requestId: newReq.id,
    stepOrder: 1,
  }).catch((err) => console.warn('[NOTIFICATION_TRIGGER_WARN] Request creation notification caught:', err));

  return newReq;
}

/**
 * Update request status with state machine enforcement
 */
export async function transitionRequestStatus(
  requestId: string,
  newStatus: RequestStatus,
  actorId?: string,
  comments?: string
) {
  const request = await db.request.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    throw new Error(`[REQUEST_NOT_FOUND] Request with ID "${requestId}" not found.`);
  }

  const currentStatus = request.status as RequestStatus;
  if (!canTransitionStatus(currentStatus, newStatus)) {
    throw new Error(
      `[INVALID_TRANSITION] Cannot transition request status from "${currentStatus}" to "${newStatus}".`
    );
  }

  return await db.$transaction(
    async (tx) => {
    const updated = await tx.request.update({
      where: { id: requestId },
      data: { status: newStatus },
    });

    await tx.auditLog.create({
      data: {
        requestId,
        actorId,
        action: 'STATUS_CHANGED',
        metadata: JSON.parse(JSON.stringify({ from: currentStatus, to: newStatus })),
        details: comments ? JSON.parse(JSON.stringify({ comments })) : undefined,
      },
    });

    return updated;
  });
}

export type WorkflowActionType =
  | 'APPROVE'
  | 'COMPLETE_STEP'
  | 'REJECT'
  | 'REQUEST_INFORMATION'
  | 'PROVIDE_INFORMATION';

export interface ExecuteWorkflowActionInput {
  requestId: string;
  actorId: string;
  action: WorkflowActionType;
  reason?: string;
  message?: string;
  field?: string;
  value?: unknown;
}

/**
 * Execute step-level workflow action with granular RBAC and deterministic validation
 */
export async function executeWorkflowAction(input: ExecuteWorkflowActionInput) {
  const { requestId, actorId, action, reason, message, field, value } = input;

  // 1. Fetch Request with relations
  const request = await db.request.findUnique({
    where: { id: requestId },
    include: {
      student: true,
      workflow: true,
      department: true,
      requestData: true,
      tasks: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!request) {
    throw new Error(`[REQUEST_NOT_FOUND] Request with ID "${requestId}" not found.`);
  }

  // 2. Fetch Actor User
  const actor = await db.user.findUnique({
    where: { id: actorId },
  });

  if (!actor) {
    throw new Error(`[USER_NOT_FOUND] Actor user with ID "${actorId}" not found.`);
  }

  // 3. Student Action: PROVIDE_INFORMATION
  if (action === 'PROVIDE_INFORMATION') {
    if (request.studentId !== actor.id) {
      throw new Error(`[FORBIDDEN] Only the request owner can provide requested information.`);
    }

    if (request.status !== 'INFORMATION_REQUIRED') {
      throw new Error(`[INVALID_ACTION] Request is not currently awaiting information.`);
    }

    const metadata = (request.requestData?.metadata as Record<string, any>) || {};
    const infoReq = metadata.informationRequest;

    const targetField = field || infoReq?.field;
    if (!targetField) {
      throw new Error(`[VALIDATION_FAILED] No field specified for information response.`);
    }

    if (value === undefined || value === null || value === '') {
      throw new Error(`[VALIDATION_FAILED] Value for field "${targetField}" cannot be empty.`);
    }

    const wfDef = getWorkflowByKey(request.workflow.key);
    if (wfDef) {
      const fieldDef = wfDef.requiredFields.find((f) => f.key === targetField);
      if (fieldDef) {
        const valRes = validateWorkflowData(wfDef, { [targetField]: value });
        const fieldError = valRes.errors.find((e) => e.field === targetField);
        if (fieldError) {
          throw new Error(`[VALIDATION_FAILED] ${fieldError.message}`);
        }
      }
    }

    const currentFormData = (request.requestData?.formData as Record<string, unknown>) || {};
    const updatedFormData = { ...currentFormData, [targetField]: value };

    const updatedMetadata = { ...metadata };
    delete updatedMetadata.informationRequest;

    const updatedReq = await db.$transaction(
    async (tx) => {
      if (request.requestData) {
        await tx.requestData.update({
          where: { id: request.requestData.id },
          data: {
            formData: JSON.parse(JSON.stringify(updatedFormData)),
            metadata: JSON.parse(JSON.stringify(updatedMetadata)),
          },
        });
      }

      const res = await tx.request.update({
        where: { id: requestId },
        data: { status: 'UNDER_REVIEW' },
      });

      await tx.auditLog.create({
        data: {
          requestId,
          actorId: actor.id,
          action: 'INFORMATION_PROVIDED',
          metadata: JSON.parse(JSON.stringify({ field: targetField, value })),
          details: JSON.parse(JSON.stringify({ message: 'Student responded to information request' })),
        },
      });

      return res;
    }, { maxWait: 15000, timeout: 25000 });

    notifyWorkflowEvent({
      eventType: 'INFORMATION_PROVIDED',
      requestId,
      actorId: actor.id,
    }).catch((e) => console.warn('[NOTIF_WARN]', e.message));

    return updatedReq;
  }

  // 4. Staff Actions: APPROVE, REJECT, REQUEST_INFORMATION
  const wfDef = getWorkflowByKey(request.workflow.key);
  if (!wfDef) {
    throw new Error(`[WORKFLOW_NOT_FOUND] Workflow definition for "${request.workflow.key}" not found.`);
  }

  const currentStepOrder = request.currentStep;
  const currentStepDef = wfDef.stepSequence[currentStepOrder - 1];
  if (!currentStepDef) {
    throw new Error(`[INVALID_STEP] Step ${currentStepOrder} is invalid for workflow "${request.workflow.key}".`);
  }

  // Self-approval prevention for staff actions
  if (request.studentId === actor.id && (action === 'APPROVE' || action === 'REJECT')) {
    throw new Error(`[FORBIDDEN] Requesters cannot approve or reject their own requests.`);
  }

  const isUnivAdmin = actor.role === 'UNIVERSITY_ADMIN';
  const isDeptAdmin = actor.role === 'DEPARTMENT_ADMIN' && actor.departmentId === request.departmentId;
  const isDeptStaff = (actor.role === 'STAFF' || actor.role === 'DEPARTMENT_ADMIN') && actor.departmentId === request.departmentId;

  let isAuthorized = isUnivAdmin;
  if (currentStepDef.requiresApproval || currentStepDef.roleRequired === 'DEPARTMENT_ADMIN') {
    isAuthorized = isAuthorized || isDeptAdmin;
  } else {
    isAuthorized = isAuthorized || isDeptStaff;
  }

  if (!isAuthorized) {
    throw new Error(
      `[FORBIDDEN] User "${actor.name}" (${actor.role}) is not authorized for step ${currentStepOrder} (${currentStepDef.name}) in department "${request.department.code}".`
    );
  }

  if (action === 'REJECT') {
    if (!reason || !reason.trim()) {
      throw new Error(`[VALIDATION_FAILED] Rejection reason is required.`);
    }

    const updatedReq = await db.$transaction(
    async (tx) => {
      const activeTask = request.tasks.find((t) => t.status === 'PENDING' || t.status === 'IN_PROGRESS');
      if (activeTask) {
        await tx.task.update({
          where: { id: activeTask.id },
          data: { status: 'SKIPPED', assigneeId: actor.id },
        });
      }

      // Record/Update Approval Record as REJECTED
      const existingApproval = await tx.approval.findFirst({
        where: { requestId, stepOrder: currentStepOrder },
      });

      if (existingApproval) {
        if (existingApproval.status === 'REJECTED' || existingApproval.status === 'APPROVED') {
          throw new Error(`[INVALID_ACTION] Approval decision has already been processed for this step.`);
        }
        await tx.approval.update({
          where: { id: existingApproval.id },
          data: {
            status: 'REJECTED',
            approverId: actor.id,
            comments: reason.trim(),
          },
        });
      } else {
        await tx.approval.create({
          data: {
            requestId,
            stepOrder: currentStepOrder,
            approverId: actor.id,
            status: 'REJECTED',
            comments: reason.trim(),
            idempotencyKey: `${requestId}:step-${currentStepOrder}:approval`,
          },
        });
      }

      const res = await tx.request.update({
        where: { id: requestId },
        data: { status: 'REJECTED' },
      });

      await tx.auditLog.create({
        data: {
          requestId,
          actorId: actor.id,
          action: 'REQUEST_REJECTED',
          metadata: JSON.parse(JSON.stringify({ reason: reason.trim(), stepOrder: currentStepOrder, stepName: currentStepDef.name })),
        },
      });

      return res;
    }, { maxWait: 15000, timeout: 25000 });

    notifyWorkflowEvent({
      eventType: 'REQUEST_REJECTED',
      requestId,
      actorId: actor.id,
      metadata: { reason: reason.trim() },
    }).catch((e) => console.warn('[NOTIF_WARN]', e.message));

    return updatedReq;
  }

  if (action === 'REQUEST_INFORMATION') {
    if (!message || !message.trim()) {
      throw new Error(`[VALIDATION_FAILED] Information request message is required.`);
    }

    const metadata = (request.requestData?.metadata as Record<string, any>) || {};
    const updatedMetadata = {
      ...metadata,
      informationRequest: {
        field: field || 'additionalInfo',
        message: message.trim(),
        requestedBy: actor.id,
        requestedAt: new Date().toISOString(),
      },
    };

    const updatedReq = await db.$transaction(
      async (tx) => {
        if (request.requestData) {
          await tx.requestData.update({
            where: { id: request.requestData.id },
            data: { metadata: JSON.parse(JSON.stringify(updatedMetadata)) },
          });
        }

        const res = await tx.request.update({
          where: { id: requestId },
          data: { status: 'INFORMATION_REQUIRED' },
        });

        await tx.auditLog.create({
          data: {
            requestId,
            actorId: actor.id,
            action: 'INFORMATION_REQUESTED',
            metadata: JSON.parse(JSON.stringify({ field: field || 'additionalInfo', message: message.trim() })),
          },
        });

        return res;
      },
      { maxWait: 15000, timeout: 25000 }
    );

    notifyWorkflowEvent({
      eventType: 'INFORMATION_REQUESTED',
      requestId,
      actorId: actor.id,
      metadata: { message: message.trim() },
    }).catch((e) => console.warn('[NOTIF_WARN]', e.message));

    return updatedReq;
  }

  if (action === 'APPROVE' || action === 'COMPLETE_STEP') {
    // MANDATORY WORKFLOW GATING: Verify required documents before step completion
    if (currentStepDef.requiresDocuments) {
      const docs = await db.document.findMany({ where: { requestId } });
      if (docs.length === 0) {
        throw new Error(
          `[VALIDATION_FAILED] Step completion blocked: Required document is missing. Please upload and verify required documents first.`
        );
      }

      const unverified = docs.filter((d) => d.verificationStatus !== 'VERIFIED');
      if (unverified.length > 0) {
        const details = unverified.map((d) => `"${d.fileName}" (${d.verificationStatus})`).join(', ');
        throw new Error(
          `[VALIDATION_FAILED] Step completion blocked: Document(s) not verified (${details}). All required documents must be VERIFIED before step signoff.`
        );
      }
    }

    let nextEventType: WorkflowEventType = 'WORKFLOW_STEP_COMPLETED';
    let nextStepNumber = currentStepOrder;

    const updatedReq = await db.$transaction(
      async (tx) => {
        const activeTask = request.tasks.find((t) => t.status === 'PENDING' || t.status === 'IN_PROGRESS');
        if (activeTask) {
          await tx.task.update({
            where: { id: activeTask.id },
            data: { status: 'COMPLETED', assigneeId: actor.id },
          });
        }

        // Record/Update Approval Record if step required approval or action is APPROVE
        if (currentStepDef.requiresApproval || action === 'APPROVE') {
          const existingApproval = await tx.approval.findFirst({
            where: { requestId, stepOrder: currentStepOrder },
          });

          if (existingApproval) {
            if (existingApproval.status === 'APPROVED') {
              throw new Error(`[INVALID_ACTION] Approval decision has already been processed for this step.`);
            }
            await tx.approval.update({
              where: { id: existingApproval.id },
              data: {
                status: 'APPROVED',
                approverId: actor.id,
                comments: reason || 'Step approved by authorized approver',
              },
            });
          } else {
            await tx.approval.create({
              data: {
                requestId,
                stepOrder: currentStepOrder,
                approverId: actor.id,
                status: 'APPROVED',
                comments: reason || 'Step approved by authorized approver',
                idempotencyKey: `${requestId}:step-${currentStepOrder}:approval`,
              },
            });
          }
        }

        const nextStepOrder = currentStepOrder + 1;
        const hasNextStep = nextStepOrder <= wfDef.stepSequence.length;

        let nextStatus: RequestStatus = 'COMPLETED';
        nextStepNumber = currentStepOrder;

        if (hasNextStep) {
          nextStepNumber = nextStepOrder;
          const nextStepDef = wfDef.stepSequence[nextStepOrder - 1];
          nextStatus = nextStepDef.requiresApproval ? 'APPROVAL_PENDING' : 'UNDER_REVIEW';

          if (nextStepDef.requiresApproval) {
            nextEventType = 'APPROVAL_REQUIRED';
            // Auto-create/reuse pending approval record for next step
            const pendingKey = `${requestId}:step-${nextStepNumber}:approval`;
            const existingNextApp = await tx.approval.findUnique({ where: { idempotencyKey: pendingKey } });
            if (!existingNextApp) {
              await tx.approval.create({
                data: {
                  requestId,
                  stepOrder: nextStepNumber,
                  status: 'PENDING',
                  idempotencyKey: pendingKey,
                },
              });
            }
          }

          const dbStep = await tx.workflowStep.findUnique({
            where: {
              workflowId_stepOrder: {
                workflowId: request.workflowId,
                stepOrder: nextStepNumber,
              },
            },
          });

          await tx.task.create({
            data: {
              requestId: request.id,
              stepId: dbStep?.id,
              title: `${nextStepDef.name}: ${request.title}`,
              description: nextStepDef.description,
              status: 'PENDING',
            },
          });
        } else {
          nextEventType = 'REQUEST_APPROVED';
        }

        const res = await tx.request.update({
          where: { id: requestId },
          data: {
            currentStep: nextStepNumber,
            status: nextStatus,
          },
        });

        await tx.auditLog.create({
          data: {
            requestId,
            actorId: actor.id,
            action: hasNextStep ? 'WORKFLOW_STEP_COMPLETED' : 'REQUEST_COMPLETED',
            metadata: JSON.parse(
              JSON.stringify({
                completedStep: currentStepDef.name,
                completedStepOrder: currentStepOrder,
                nextStep: hasNextStep ? wfDef.stepSequence[nextStepOrder - 1].name : null,
                newStatus: nextStatus,
              })
            ),
          },
        });

        return res;
      },
      { maxWait: 15000, timeout: 25000 }
    );

    notifyWorkflowEvent({
      eventType: nextEventType,
      requestId,
      stepOrder: nextStepNumber,
      actorId: actor.id,
    }).catch((e) => console.warn('[NOTIF_WARN]', e.message));

    return updatedReq;
  }

  throw new Error(`[INVALID_ACTION] Unsupported action "${action}".`);
}

/**
 * Assign request to department staff or user
 */
export async function assignRequest(
  requestId: string,
  assignedUserId?: string,
  assignedDepartmentId?: string,
  actorId?: string
) {
  return await db.$transaction(async (tx) => {
    const dataToUpdate: Record<string, unknown> = {};
    if (assignedUserId) dataToUpdate.assignedUserId = assignedUserId;
    if (assignedDepartmentId) dataToUpdate.departmentId = assignedDepartmentId;

    const updated = await tx.request.update({
      where: { id: requestId },
      data: dataToUpdate,
    });

    await tx.auditLog.create({
      data: {
        requestId,
        actorId,
        action: 'REQUEST_ASSIGNED',
        metadata: JSON.parse(JSON.stringify({ assignedUserId, assignedDepartmentId })),
      },
    });

    return updated;
  });
}

/**
 * Append audit log entry
 */
export async function appendAuditLog(
  requestId: string,
  actorId: string | undefined,
  action: string,
  metadata?: Record<string, unknown>
) {
  return await db.auditLog.create({
    data: {
      requestId,
      actorId,
      action,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
    },
  });
}

/**
 * Get unified audit timeline events for student request tracking
 */
export async function getRequestTimeline(requestId: string): Promise<TimelineEvent[]> {
  const auditLogs = await db.auditLog.findMany({
    where: { requestId },
    include: { actor: true },
    orderBy: { createdAt: 'asc' },
  });

  const tasks = await db.task.findMany({
    where: { requestId },
    include: { assignee: true },
    orderBy: { createdAt: 'asc' },
  });

  const approvals = await db.approval.findMany({
    where: { requestId },
    include: { approver: true },
    orderBy: { createdAt: 'asc' },
  });

  const events: TimelineEvent[] = [];

  for (const log of auditLogs) {
    let description = 'Action logged';
    const meta = (log.metadata as any) || {};

    if (log.action === 'REQUEST_CREATED') {
      description = `Request submitted (${meta.workflowKey || 'Workflow'})`;
    } else if (log.action === 'WORKFLOW_STEP_COMPLETED') {
      description = `Step "${meta.completedStep || 'Step'}" completed`;
    } else if (log.action === 'REQUEST_APPROVED') {
      description = 'Request approved';
    } else if (log.action === 'REQUEST_REJECTED') {
      description = `Rejected: ${meta.reason || 'No reason provided'}`;
    } else if (log.action === 'INFORMATION_REQUESTED') {
      description = `Information requested: "${meta.message || 'Details required'}"`;
    } else if (log.action === 'INFORMATION_PROVIDED') {
      description = `Student provided response for field "${meta.field || 'input'}"`;
    } else if (log.action === 'STATUS_CHANGED') {
      description = `Status changed to ${meta.to || 'updated'}`;
    } else if (log.action === 'REQUEST_COMPLETED') {
      description = 'All workflow steps completed successfully';
    }

    events.push({
      id: log.id,
      timestamp: log.createdAt.toISOString(),
      title: log.action.replace(/_/g, ' '),
      description,
      actorName: log.actor?.name || 'System',
      actorRole: log.actor?.role || 'SYSTEM',
      type: 'AUDIT',
      metadata: (log.metadata as Record<string, unknown>) || undefined,
    });
  }

  for (const task of tasks) {
    events.push({
      id: task.id,
      timestamp: task.createdAt.toISOString(),
      title: `Task: ${task.title}`,
      description: `Task status: ${task.status}`,
      actorName: task.assignee?.name || 'Unassigned Staff',
      type: 'TASK',
    });
  }

  for (const app of approvals) {
    events.push({
      id: app.id,
      timestamp: app.createdAt.toISOString(),
      title: `Approval: ${app.status}`,
      description: app.comments || 'Review completed',
      actorName: app.approver?.name || 'Authorized Approver',
      actorRole: app.approver?.role || 'DEPARTMENT_ADMIN',
      type: 'APPROVAL',
    });
  }

  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return events;
}

/**
 * Log AgentRun telemetry for AI execution tracing
 */
export async function logAgentRun(input: {
  agentType: string;
  actorId?: string;
  requestId?: string;
  promptInput: string;
  aiOutputJson: Record<string, unknown>;
  status?: string;
  executionTimeMs?: number;
  error?: string;
}) {
  try {
    return await db.agentRun.create({
      data: {
        agentType: input.agentType,
        actorId: input.actorId,
        requestId: input.requestId,
        promptInput: input.promptInput,
        input: input.promptInput,
        aiOutputJson: JSON.parse(JSON.stringify(input.aiOutputJson)),
        output: JSON.parse(JSON.stringify(input.aiOutputJson)),
        status: input.status || 'COMPLETED',
        executionTimeMs: input.executionTimeMs || 0,
        error: input.error,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });
  } catch (err) {
    console.warn('[AGENT_RUN_LOGGING_WARNING] Could not record AgentRun telemetry:', err);
  }
}

