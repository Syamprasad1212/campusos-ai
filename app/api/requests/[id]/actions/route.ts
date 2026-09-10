import { NextResponse } from 'next/server';
import { executeWorkflowAction } from '@/lib/workflows/service';
import { getCurrentAppUser } from '@/lib/auth/session';
import { checkRateLimit, getClientIdentifier, RATE_LIMIT_CONFIGS } from '@/lib/ratelimit';
import { handleApiError, createErrorResponse } from '@/lib/errors';
import { logger } from '@/lib/observability/logger';

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return createErrorResponse('Unauthenticated', 'UNAUTHENTICATED', 401);
    }

    // Rate Limiting Protection
    const rateLimitId = getClientIdentifier(req, user.id);
    const rateLimit = checkRateLimit(rateLimitId, RATE_LIMIT_CONFIGS.WORKFLOW_ACTION);
    if (!rateLimit.success) {
      logger.security('RATE_LIMITED', `Rate limit exceeded for workflow action: ${rateLimitId}`, {
        userId: user.id,
        action: 'EXECUTE_WORKFLOW_ACTION',
      });
      return createErrorResponse(
        'Too many workflow actions. Please wait a moment.',
        'RATE_LIMITED',
        429,
        undefined,
        { 'Retry-After': String(Math.ceil((rateLimit.reset - Date.now()) / 1000)) }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { action, reason, message, field, value } = body;

    if (!action) {
      return createErrorResponse('Action name is required', 'VALIDATION_ERROR', 400);
    }

    const result = await executeWorkflowAction({
      requestId: params.id,
      actorId: user.id,
      action,
      reason,
      message,
      field,
      value,
    });

    logger.info('STATUS_CHANGED', `Workflow action "${action}" executed on request ${params.id}`, {
      requestId: params.id,
      userId: user.id,
      action,
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: `Action "${action}" executed successfully`,
    });
  } catch (error: unknown) {
    logger.error('API_ERROR', `POST /api/requests/${params.id}/actions failed`, {
      requestId: params.id,
      error: String(error),
    });
    return handleApiError(error, 'Failed to execute workflow action');
  }
}
