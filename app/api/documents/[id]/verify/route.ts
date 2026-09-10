import { NextResponse } from 'next/server';
import { verifyDocumentByStaff } from '@/lib/documents/service';
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
      logger.security('RATE_LIMITED', `Rate limit exceeded for document verification: ${rateLimitId}`, {
        userId: user.id,
        action: 'VERIFY_DOCUMENT',
      });
      return createErrorResponse(
        'Too many document verification actions. Please wait a moment.',
        'RATE_LIMITED',
        429,
        undefined,
        { 'Retry-After': String(Math.ceil((rateLimit.reset - Date.now()) / 1000)) }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { status, reason } = body;

    if (!status || (status !== 'VERIFIED' && status !== 'REJECTED')) {
      return createErrorResponse('Verification status must be VERIFIED or REJECTED', 'VALIDATION_ERROR', 400);
    }

    const result = await verifyDocumentByStaff({
      documentId: params.id,
      actorId: user.id,
      status,
      reason,
    });

    logger.info(status === 'VERIFIED' ? 'DOCUMENT_VERIFIED' : 'DOCUMENT_REJECTED', `Document ${params.id} ${status} by staff ${user.id}`, {
      userId: user.id,
      action: status,
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: `Document status updated to ${status}`,
    });
  } catch (error: unknown) {
    logger.error('API_ERROR', `POST /api/documents/${params.id}/verify failed`, { error: String(error) });
    return handleApiError(error, 'Failed to verify document');
  }
}
