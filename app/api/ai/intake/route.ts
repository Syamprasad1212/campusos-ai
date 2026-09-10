import { NextResponse } from 'next/server';
import { getCurrentAppUser } from '@/lib/auth/session';
import { runIntakeAgent } from '@/lib/agents/intake-agent';
import { checkRateLimit, getClientIdentifier, RATE_LIMIT_CONFIGS } from '@/lib/ratelimit';
import { handleApiError, createErrorResponse } from '@/lib/errors';
import { logger } from '@/lib/observability/logger';

export async function POST(req: Request) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return createErrorResponse('Authenticated session required', 'UNAUTHENTICATED', 401);
    }

    // Rate Limiting Protection
    const rateLimitId = getClientIdentifier(req, user.id);
    const rateLimit = checkRateLimit(rateLimitId, RATE_LIMIT_CONFIGS.AI_INTAKE);
    if (!rateLimit.success) {
      logger.security('RATE_LIMITED', `Rate limit exceeded for AI intake: ${rateLimitId}`, {
        userId: user.id,
        action: 'AI_INTAKE',
      });
      return createErrorResponse(
        'Too many AI requests. Please wait a moment before trying again.',
        'RATE_LIMITED',
        429,
        undefined,
        { 'Retry-After': String(Math.ceil((rateLimit.reset - Date.now()) / 1000)) }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { message, conversationContext } = body;

    if (!message || typeof message !== 'string') {
      return createErrorResponse('Request body must contain a valid "message" string', 'VALIDATION_ERROR', 400);
    }

    const result = await runIntakeAgent({
      userId: user.id,
      message,
      conversationContext,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    logger.error('API_ERROR', 'AI intake route error', { error: String(error) });
    return handleApiError(error, 'AI Intake agent processing failed');
  }
}
