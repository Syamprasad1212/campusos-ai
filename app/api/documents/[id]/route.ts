import { NextResponse } from 'next/server';
import { getAuthorizedDocumentUrl } from '@/lib/documents/service';
import { getCurrentAppUser } from '@/lib/auth/session';
import { handleApiError, createErrorResponse } from '@/lib/errors';
import { logger } from '@/lib/observability/logger';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return createErrorResponse('Unauthenticated', 'UNAUTHENTICATED', 401);
    }

    const result = await getAuthorizedDocumentUrl(params.id, user);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    logger.error('API_ERROR', `GET /api/documents/${params.id} failed`, { error: String(error) });
    return handleApiError(error, 'Failed to fetch document');
  }
}
