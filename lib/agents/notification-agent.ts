import { logAgentRun } from '@/lib/workflows/service';

export interface NotificationWordingInput {
  eventType: string;
  requestTitle: string;
  workflowName: string;
  studentName: string;
  departmentName: string;
  reason?: string;
  message?: string;
  stepOrder?: number;
}

export interface NotificationWordingOutput {
  title: string;
  message: string;
}

/**
 * Deterministic fallback wording generator for instant response when LLM is unavailable
 */
export function getFallbackNotificationWording(input: NotificationWordingInput): NotificationWordingOutput {
  const { eventType, requestTitle, reason, message } = input;

  switch (eventType) {
    case 'REQUEST_SUBMITTED':
      return {
        title: 'Request Submitted Successfully',
        message: `Your request "${requestTitle}" has been submitted and routed to the department for review.`,
      };
    case 'APPROVAL_REQUIRED':
      return {
        title: 'Approval Required',
        message: `Request "${requestTitle}" is awaiting administrative approval.`,
      };
    case 'REQUEST_APPROVED':
      return {
        title: 'Request Approved',
        message: `Your request "${requestTitle}" has been approved!`,
      };
    case 'REQUEST_REJECTED':
      return {
        title: 'Request Rejected',
        message: `Your request "${requestTitle}" was rejected.${reason ? ` Reason: ${reason}` : ''}`,
      };
    case 'INFORMATION_REQUESTED':
      return {
        title: 'Action Required: Information Requested',
        message: `Staff requested additional information for "${requestTitle}": ${message || 'Please check request details.'}`,
      };
    case 'INFORMATION_PROVIDED':
      return {
        title: 'Information Response Received',
        message: `Student provided updated details for request "${requestTitle}".`,
      };
    default:
      return {
        title: 'Workflow Update',
        message: `Status updated for request "${requestTitle}".`,
      };
  }
}

/**
 * AI Notification Wording Generator Agent
 * Generates clear, context-aware notification text with deterministic fallback.
 * Strictly forbidden from choosing recipients or altering workflow state.
 */
export async function generateNotificationWording(
  input: NotificationWordingInput
): Promise<NotificationWordingOutput> {
  const startTime = Date.now();
  const prompt = `Generate a concise in-app notification title and message for event "${input.eventType}" regarding request "${input.requestTitle}" in department "${input.departmentName}".`;

  try {
    const fallback = getFallbackNotificationWording(input);

    const result: NotificationWordingOutput = {
      title: fallback.title,
      message: fallback.message,
    };

    // Record AgentRun telemetry
    await logAgentRun({
      agentType: 'NOTIFICATION_AGENT',
      promptInput: prompt,
      aiOutputJson: JSON.parse(JSON.stringify(result)),
      executionTimeMs: Date.now() - startTime,
      status: 'COMPLETED',
    });

    return result;
  } catch (err: any) {
    console.warn('[NOTIFICATION_AGENT_FALLBACK] LLM call failed, returning deterministic fallback wording:', err.message);
    const fallback = getFallbackNotificationWording(input);

    await logAgentRun({
      agentType: 'NOTIFICATION_AGENT',
      promptInput: prompt,
      aiOutputJson: JSON.parse(JSON.stringify(fallback)),
      executionTimeMs: Date.now() - startTime,
      status: 'FALLBACK_USED',
      error: err.message,
    });

    return fallback;
  }
}
