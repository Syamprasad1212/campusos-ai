/**
 * CampusOS Agent Tool Contracts
 * 
 * CONTROLLED CAPABILITIES LAYER FOR FUTURE SUBAGENTS:
 * - Intake Agent
 * - Workflow Agent
 * - Document Agent
 * - Routing Agent
 * - Validation Agent
 * - Approval Agent
 * - Notification Agent
 * 
 * CRITICAL ARCHITECTURE RULE:
 * Subagents MUST invoke these server-side tool contracts.
 * Direct database/Prisma mutation by subagents is STRICTLY PROHIBITED.
 */

import {
  getWorkflowByKey,
  listActiveWorkflows,
  validateWorkflowData,
  createWorkflowRequest,
  transitionRequestStatus,
  assignRequest,
  appendAuditLog,
  getRequestTimeline,
} from '@/lib/workflows/service';
import { canAccessRequest, assertPermission } from '@/lib/permissions';
import { CreateRequestInput, RequestStatus, UserSession } from '@/types';

// ============================================================================
// 1. INTAKE & WORKFLOW SELECTION AGENT TOOLS
// ============================================================================

export async function toolGetActiveWorkflows() {
  return listActiveWorkflows();
}

export async function toolGetWorkflow(key: string) {
  const wf = getWorkflowByKey(key);
  if (!wf) {
    throw new Error(`[AGENT_TOOL_ERROR] Workflow with key "${key}" not found.`);
  }
  return wf;
}

// ============================================================================
// 2. VALIDATION AGENT TOOLS
// ============================================================================

export async function toolValidateRequestData(workflowKey: string, data: Record<string, unknown>) {
  const wf = getWorkflowByKey(workflowKey);
  if (!wf) {
    throw new Error(`[AGENT_TOOL_ERROR] Invalid workflow key "${workflowKey}".`);
  }
  return validateWorkflowData(wf, data);
}

// ============================================================================
// 3. INTAKE AGENT SUBMISSION TOOL
// ============================================================================

export async function toolCreateRequest(user: UserSession, input: CreateRequestInput) {
  // Boundary Check: Intake Agent cannot impersonate other users
  if (user.id !== input.requesterId && user.role !== 'UNIVERSITY_ADMIN') {
    throw new Error('[AGENT_SECURITY_VIOLATION] Requester ID must match user session.');
  }
  return createWorkflowRequest(input);
}

// ============================================================================
// 4. ROUTING AGENT TOOLS
// ============================================================================

export async function toolRouteRequest(
  user: UserSession,
  requestId: string,
  targetDepartmentId?: string,
  targetUserId?: string
) {
  // Boundary Check: Routing agent can only operate if caller has staff or admin role
  assertPermission(
    user.role === 'STAFF' || user.role === 'DEPARTMENT_ADMIN' || user.role === 'UNIVERSITY_ADMIN',
    'Only staff/admins can assign or route requests'
  );

  return assignRequest(requestId, targetUserId, targetDepartmentId, user.id);
}

// ============================================================================
// 5. APPROVAL & WORKFLOW AGENT STATUS TRANSITION TOOL
// ============================================================================

export async function toolUpdateStatus(
  user: UserSession,
  requestId: string,
  targetStatus: RequestStatus,
  comments?: string
) {
  // Boundary Check: Students cannot approve or reject requests
  if (targetStatus === 'APPROVED' || targetStatus === 'REJECTED') {
    assertPermission(
      user.role === 'STAFF' || user.role === 'DEPARTMENT_ADMIN' || user.role === 'UNIVERSITY_ADMIN',
      'Students cannot approve or reject requests'
    );
  }

  return transitionRequestStatus(requestId, targetStatus, user.id, comments);
}

// ============================================================================
// 6. STATUS TRACKING & TIMELINE TOOLS
// ============================================================================

export async function toolGetRequestState(user: UserSession, requestId: string) {
  const timeline = await getRequestTimeline(requestId);
  return {
    requestId,
    timeline,
  };
}

export async function toolAppendAudit(
  user: UserSession,
  requestId: string,
  action: string,
  metadata?: Record<string, unknown>
) {
  return appendAuditLog(requestId, user.id, action, metadata);
}

// ============================================================================
// 7. DOCUMENT AGENT CONTROLLED TOOLS
// ============================================================================

export async function toolGetRequestDocuments(user: UserSession, requestId: string) {
  const { db } = await import('@/lib/db');
  const request = await db.request.findUnique({ where: { id: requestId } });
  if (!request) {
    throw new Error(`[AGENT_TOOL_ERROR] Request "${requestId}" not found.`);
  }

  if (!canAccessRequest(user, request.studentId, request.departmentId)) {
    throw new Error(`[FORBIDDEN] Cannot access documents for request.`);
  }

  return db.document.findMany({
    where: { requestId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function toolClassifyDocument(input: {
  userId: string;
  requestId: string;
  fileName: string;
  mimeType: string;
  extractedText: string;
}) {
  const { runDocumentAgent } = await import('@/lib/agents/document-agent');
  return runDocumentAgent(input);
}

export async function toolValidateDocument(input: {
  fileName: string;
  fileType: string;
  fileSize: number;
  aiDocumentType?: string;
  aiConfidence?: number;
  extractedData?: Record<string, unknown>;
  studentProfile?: { id: string; name: string; email: string };
}) {
  const { validateDocumentSubmission } = await import('@/lib/documents/validation');
  return validateDocumentSubmission(input);
}

// ============================================================================
// 8. AGENT TELEMETRY & RUN LOGGING TOOL
// ============================================================================

export async function toolLogAgentRun(input: {
  agentType: string;
  actorId?: string;
  requestId?: string;
  promptInput: string;
  aiOutputJson: Record<string, unknown>;
  status?: string;
  executionTimeMs?: number;
  error?: string;
}) {
  const { logAgentRun } = await import('@/lib/workflows/service');
  return logAgentRun(input);
}

// ============================================================================
// 9. APPROVAL ADVISORY & NOTIFICATION AGENT TOOLS (STAGE 7)
// ============================================================================

export async function toolGetApprovalAdvisory(user: UserSession, requestId: string) {
  const { runApprovalAgent } = await import('@/lib/agents/approval-agent');
  return runApprovalAgent(requestId, user);
}

export async function toolGetUserNotifications(user: UserSession) {
  const { getUserNotifications } = await import('@/lib/notifications/service');
  return getUserNotifications(user.id);
}

export async function toolMarkNotificationRead(user: UserSession, notificationId: string) {
  const { markNotificationAsRead } = await import('@/lib/notifications/service');
  return markNotificationAsRead(notificationId, user.id);
}

