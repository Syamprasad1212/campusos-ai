import { db } from '@/lib/db';
import { generateNotificationWording } from '@/lib/agents/notification-agent';

export type WorkflowEventType =
  | 'REQUEST_SUBMITTED'
  | 'APPROVAL_REQUIRED'
  | 'REQUEST_APPROVED'
  | 'REQUEST_REJECTED'
  | 'INFORMATION_REQUESTED'
  | 'INFORMATION_PROVIDED'
  | 'WORKFLOW_STEP_COMPLETED';

export interface NotifyEventInput {
  eventType: WorkflowEventType;
  requestId: string;
  stepOrder?: number;
  actorId?: string;
  metadata?: Record<string, any>;
}

/**
 * 1. DETERMINISTIC RECIPIENT RESOLUTION
 * Backend resolves notification recipients strictly from workflow context and RBAC roles.
 * AI agents MUST NOT determine notification recipient IDs.
 */
export async function resolveNotificationRecipients(
  eventType: WorkflowEventType,
  requestId: string,
  stepOrder?: number,
  existingRequest?: { studentId: string; departmentId: string }
): Promise<string[]> {
  const request = existingRequest || (await db.request.findUnique({
    where: { id: requestId },
    select: { studentId: true, departmentId: true },
  }));

  if (!request) {
    return [];
  }

  const recipients = new Set<string>();

  if (eventType === 'REQUEST_SUBMITTED') {
    // Notify Student Requester (Confirmation)
    recipients.add(request.studentId);

    // Notify Department Staff & Admins
    const deptStaff = await db.user.findMany({
      where: {
        departmentId: request.departmentId,
        role: { in: ['STAFF', 'DEPARTMENT_ADMIN'] },
      },
      select: { id: true },
    });
    deptStaff.forEach((u) => recipients.add(u.id));
  } else if (eventType === 'APPROVAL_REQUIRED') {
    // Notify Department Admins & University Admins for approval signoff
    const approvers = await db.user.findMany({
      where: {
        OR: [
          { role: 'DEPARTMENT_ADMIN', departmentId: request.departmentId },
          { role: 'UNIVERSITY_ADMIN' },
        ],
      },
      select: { id: true },
    });
    approvers.forEach((u) => recipients.add(u.id));
  } else if (eventType === 'REQUEST_APPROVED' || eventType === 'REQUEST_REJECTED' || eventType === 'INFORMATION_REQUESTED') {
    // Notify Student Requester
    recipients.add(request.studentId);
  } else if (eventType === 'INFORMATION_PROVIDED') {
    // Notify Department Staff
    const deptStaff = await db.user.findMany({
      where: {
        departmentId: request.departmentId,
        role: { in: ['STAFF', 'DEPARTMENT_ADMIN'] },
      },
      select: { id: true },
    });
    deptStaff.forEach((u) => recipients.add(u.id));
  } else if (eventType === 'WORKFLOW_STEP_COMPLETED') {
    // Notify Student
    recipients.add(request.studentId);
  }

  return Array.from(recipients);
}

/**
 * 2. IDEMPOTENT NOTIFICATION PERSISTENCE
 * Ensures duplicate workflow events do not generate duplicate notifications.
 * Uses DB unique constraint on `idempotencyKey`.
 */
export async function createIdempotentNotification(input: {
  userId: string;
  title: string;
  message: string;
  requestId?: string;
  eventType?: string;
  stepOrder?: number;
  idempotencyKey?: string;
}) {
  const { userId, title, message, requestId, eventType, stepOrder } = input;

  const key =
    input.idempotencyKey ||
    `${requestId || 'sys'}:${userId}:${eventType || 'GENERIC'}:${stepOrder || 1}`;

  try {
    const existing = await db.notification.findUnique({
      where: { idempotencyKey: key },
    });

    if (existing) {
      return existing;
    }

    const notification = await db.notification.create({
      data: {
        requestId,
        userId,
        title,
        message,
        eventType,
        stepOrder,
        idempotencyKey: key,
        isRead: false,
      },
    });

    // Record NOTIFICATION_CREATED in AuditLog
    await db.auditLog.create({
      data: {
        requestId,
        actorId: userId,
        action: 'NOTIFICATION_CREATED',
        metadata: JSON.parse(
          JSON.stringify({
            notificationId: notification.id,
            userId,
            eventType,
            title,
          })
        ),
      },
    });

    return notification;
  } catch (err: any) {
    // Handle unique constraint collision gracefully (idempotent no-op)
    if (err.code === 'P2002') {
      const found = await db.notification.findUnique({ where: { idempotencyKey: key } });
      if (found) return found;
    }
    console.warn('[NOTIFICATION_PERSISTENCE_WARN] Idempotent notification save caught:', err.message);
    return null;
  }
}

/**
 * 3. NON-BLOCKING POST-TRANSITION NOTIFICATION TRIGGER
 * Executes as a safe post-transition side effect. Failure does NOT invalidate workflow transitions.
 */
export async function notifyWorkflowEvent(input: NotifyEventInput): Promise<void> {
  try {
    const { eventType, requestId, stepOrder, metadata } = input;

    const request = await db.request.findUnique({
      where: { id: requestId },
      include: { student: true, workflow: true, department: true },
    });

    if (!request) return;

    // Resolves recipients deterministically without duplicate DB request lookup
    const [recipientUserIds, wording] = await Promise.all([
      resolveNotificationRecipients(eventType, requestId, stepOrder, request),
      generateNotificationWording({
        eventType,
        requestTitle: request.title,
        workflowName: request.workflow.name,
        studentName: request.student.name,
        departmentName: request.department.name,
        reason: metadata?.reason,
        message: metadata?.message,
        stepOrder,
      }),
    ]);

    if (recipientUserIds.length === 0) return;

    // Parallelize idempotent persistence across all recipients
    await Promise.all(
      recipientUserIds.map((userId) => {
        const idempotencyKey = `${requestId}:${userId}:${eventType}:${stepOrder || request.currentStep}`;
        return createIdempotentNotification({
          userId,
          title: wording.title,
          message: wording.message,
          requestId,
          eventType,
          stepOrder: stepOrder || request.currentStep,
          idempotencyKey,
        });
      })
    );
  } catch (err: any) {
    console.warn('[NOTIFICATION_TRIGGER_NON_BLOCKING_ERROR] Notification processing error:', err.message);
  }
}

/**
 * 4. GET USER NOTIFICATIONS
 */
export async function getUserNotifications(userId: string) {
  const [notifications, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    db.notification.count({
      where: { userId, isRead: false },
    }),
  ]);

  return {
    notifications,
    unreadCount,
  };
}

/**
 * 5. MARK NOTIFICATION AS READ
 */
export async function markNotificationAsRead(notificationId: string, userId: string) {
  const notification = await db.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new Error(`[NOT_FOUND] Notification with ID "${notificationId}" not found.`);
  }

  if (notification.userId !== userId) {
    throw new Error(`[FORBIDDEN] You cannot mark another user's notification as read.`);
  }

  const updated = await db.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });

  await db.auditLog.create({
    data: {
      requestId: notification.requestId,
      actorId: userId,
      action: 'NOTIFICATION_READ',
      metadata: JSON.parse(
        JSON.stringify({
          notificationId,
          title: notification.title,
        })
      ),
    },
  });

  return updated;
}
