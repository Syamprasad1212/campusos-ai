import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createWorkflowRequest } from '@/lib/workflows/service';
import { getCurrentAppUser } from '@/lib/auth/session';
import { checkRateLimit, getClientIdentifier, RATE_LIMIT_CONFIGS } from '@/lib/ratelimit';
import { handleApiError, createErrorResponse } from '@/lib/errors';
import { logger } from '@/lib/observability/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return createErrorResponse('Unauthenticated', 'UNAUTHENTICATED', 401);
    }

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10), 1), 200);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

    // Build database-level RBAC where filter
    const whereClause: Record<string, any> = {};

    if (user.role === 'STUDENT' || user.role === 'FACULTY') {
      whereClause.studentId = user.id;
    } else if (user.role === 'STAFF' || user.role === 'DEPARTMENT_ADMIN') {
      if (user.departmentId) {
        whereClause.departmentId = user.departmentId;
      }
    }
    // UNIVERSITY_ADMIN has full platform visibility across all departments

    if (statusParam) {
      whereClause.status = statusParam;
    }

    const authorizedRequests = await db.request.findMany({
      where: whereClause,
      include: {
        student: true,
        workflow: true,
        department: true,
        requestData: true,
        tasks: { include: { assignee: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return NextResponse.json(
      {
        success: true,
        data: authorizedRequests,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (error: unknown) {
    logger.error('API_ERROR', 'GET /api/requests failed', { error: String(error) });
    return handleApiError(error, 'Failed to fetch requests');
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return createErrorResponse('Unauthenticated', 'UNAUTHENTICATED', 401);
    }

    // Rate Limiting Protection
    const rateLimitId = getClientIdentifier(req, user.id);
    const rateLimit = checkRateLimit(rateLimitId, RATE_LIMIT_CONFIGS.REQUEST_CREATION);
    if (!rateLimit.success) {
      logger.security('RATE_LIMITED', `Rate limit exceeded for request creation: ${rateLimitId}`, {
        userId: user.id,
        action: 'CREATE_REQUEST',
      });
      return createErrorResponse(
        'Too many request creations. Please wait a moment.',
        'RATE_LIMITED',
        429,
        undefined,
        { 'Retry-After': String(Math.ceil((rateLimit.reset - Date.now()) / 1000)) }
      );
    }

    const body = await req.json().catch(() => ({}));

    // Security Rule: Overwrite requesterId with authenticated user ID
    // Do NOT trust client-provided requesterId or role!
    const createInput = {
      ...body,
      requesterId: user.id,
      idempotencyKey: typeof body.idempotencyKey === 'string' ? body.idempotencyKey : undefined,
    };

    const result = await createWorkflowRequest(createInput);

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: 'Request created successfully',
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    logger.error('API_ERROR', 'POST /api/requests failed', { error: String(error) });
    return handleApiError(error, 'Failed to create workflow request');
  }
}
