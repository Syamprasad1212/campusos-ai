import { NextResponse } from 'next/server';
import { processAndStoreDocument } from '@/lib/documents/service';
import { createSignedDocumentUrl } from '@/lib/storage/documents';
import { getCurrentAppUser } from '@/lib/auth/session';
import { canAccessRequest } from '@/lib/permissions';
import { db } from '@/lib/db';
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
    const rateLimit = checkRateLimit(rateLimitId, RATE_LIMIT_CONFIGS.DOCUMENT_UPLOAD);
    if (!rateLimit.success) {
      logger.security('RATE_LIMITED', `Rate limit exceeded for document upload: ${rateLimitId}`, {
        userId: user.id,
        action: 'DOCUMENT_UPLOAD',
      });
      return createErrorResponse(
        'Too many document uploads. Please wait a moment.',
        'RATE_LIMITED',
        429,
        undefined,
        { 'Retry-After': String(Math.ceil((rateLimit.reset - Date.now()) / 1000)) }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const documentType = (formData.get('documentType') as string) || undefined;

    if (!file) {
      return createErrorResponse('No file uploaded in request', 'VALIDATION_ERROR', 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    const result = await processAndStoreDocument({
      requestId: params.id,
      uploaderId: user.id,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      fileBuffer,
      documentType,
    });

    logger.info('DOCUMENT_UPLOADED', `Document uploaded for request ${params.id}: ${file.name}`, {
      requestId: params.id,
      userId: user.id,
    });

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: 'Document uploaded and processed successfully',
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    logger.error('API_ERROR', `POST /api/requests/${params.id}/documents failed`, {
      requestId: params.id,
      error: String(error),
    });
    return handleApiError(error, 'Failed to process document upload');
  }
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthenticated' },
        { status: 401 }
      );
    }

    const request = await db.request.findUnique({
      where: { id: params.id },
    });

    if (!request) {
      return NextResponse.json(
        { success: false, error: `Request "${params.id}" not found` },
        { status: 404 }
      );
    }

    if (!canAccessRequest(user, request.studentId, request.departmentId)) {
      return NextResponse.json(
        { success: false, error: '[FORBIDDEN] You do not have permission to view documents for this request' },
        { status: 403 }
      );
    }

    const documents = await db.document.findMany({
      where: { requestId: params.id },
      include: { uploadedBy: true },
      orderBy: { createdAt: 'desc' },
    });

    // Generate short-lived signed URLs for documents safely
    const docsWithSignedUrls = await Promise.all(
      documents.map(async (doc) => {
        let signedUrl = '';
        try {
          signedUrl = await createSignedDocumentUrl(doc.storageReference || doc.fileUrl, 3600);
        } catch (err) {
          // If storage signed URL generation fails, fallback gracefully to path
          signedUrl = doc.fileUrl;
        }

        return {
          ...doc,
          signedUrl,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: docsWithSignedUrls,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch request documents' },
      { status: 500 }
    );
  }
}
