import { NextResponse } from 'next/server';
import { getCurrentAppUser } from '@/lib/auth/session';
import { toolCreateRequest, toolLogAgentRun } from '@/lib/agents/tools';
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
    const rateLimit = checkRateLimit(rateLimitId, RATE_LIMIT_CONFIGS.REQUEST_CREATION);
    if (!rateLimit.success) {
      logger.security('RATE_LIMITED', `Rate limit exceeded for request confirmation: ${rateLimitId}`, {
        userId: user.id,
        action: 'CONFIRM_REQUEST',
      });
      return createErrorResponse(
        'Too many request creation attempts. Please wait a moment before trying again.',
        'RATE_LIMITED',
        429,
        undefined,
        { 'Retry-After': String(Math.ceil((rateLimit.reset - Date.now()) / 1000)) }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { workflowKey, data, title, summary, idempotencyKey } = body;

    if (!workflowKey || typeof workflowKey !== 'string') {
      return createErrorResponse('Request body must contain a valid "workflowKey"', 'VALIDATION_ERROR', 400);
    }

    // Security Rule: Enforce authenticated user identity & optional user-scoped idempotency
    const requestInput = {
      requesterId: user.id,
      workflowKey,
      title,
      summary,
      data: data || {},
      idempotencyKey: typeof idempotencyKey === 'string' ? idempotencyKey : undefined,
    };

    const startTime = Date.now();
    const createdRequest = await toolCreateRequest(user, requestInput);

    // Log AgentRun for workflow confirmation
    await toolLogAgentRun({
      agentType: 'INTAKE_CONFIRM_AGENT',
      actorId: user.id,
      requestId: createdRequest.id,
      promptInput: `Confirmed workflow: ${workflowKey}`,
      aiOutputJson: JSON.parse(JSON.stringify({ requestId: createdRequest.id, referenceNo: createdRequest.referenceNo })),
      status: 'COMPLETED',
      executionTimeMs: Date.now() - startTime,
    });

    return NextResponse.json({
      success: true,
      data: createdRequest,
      message: 'Workflow request confirmed and submitted successfully',
    }, { status: 201 });
  } catch (error: unknown) {
    logger.error('API_ERROR', 'Intake confirm route error', { error: String(error) });
    return handleApiError(error, 'Workflow confirmation failed');
  }
}
