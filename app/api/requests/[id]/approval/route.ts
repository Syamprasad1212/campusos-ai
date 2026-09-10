import { NextResponse } from 'next/server';
import { getCurrentAppUser } from '@/lib/auth/session';
import { executeWorkflowAction } from '@/lib/workflows/service';
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
      logger.security('RATE_LIMITED', `Rate limit exceeded for approval decision: ${rateLimitId}`, {
        userId: user.id,
        action: 'APPROVAL_DECISION',
      });
      return createErrorResponse(
        'Too many approval attempts. Please wait a moment.',
        'RATE_LIMITED',
        429,
        undefined,
        { 'Retry-After': String(Math.ceil((rateLimit.reset - Date.now()) / 1000)) }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { action, reason } = body;

    if (!action || (action !== 'APPROVE' && action !== 'REJECT')) {
      return createErrorResponse('Invalid approval action. Must be "APPROVE" or "REJECT".', 'VALIDATION_ERROR', 400);
    }

    const updatedRequest = await executeWorkflowAction({
      requestId: params.id,
      actorId: user.id,
      action,
      reason,
    });

    logger.info('APPROVAL_COMPLETED', `Approval decision "${action}" executed on request ${params.id}`, {
      requestId: params.id,
      userId: user.id,
      action,
    });

    return NextResponse.json({
      success: true,
      data: updatedRequest,
    });
  } catch (error: unknown) {
    logger.error('API_ERROR', `POST /api/requests/${params.id}/approval failed`, {
      requestId: params.id,
      error: String(error),
    });
    return handleApiError(error, 'Failed to process approval action');
  }
}
