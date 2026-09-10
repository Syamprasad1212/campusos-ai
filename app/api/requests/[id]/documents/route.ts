import { NextResponse } from 'next/server';
import { processAndStoreDocument } from '@/lib/documents/service';
import { createSignedDocumentUrl } from '@/lib/storage/documents';
import { getCurrentAppUser } from '@/lib/auth/session';
import { canAccessRequest } from '@/lib/permissions';
import { db } from '@/lib/db';

export async function POST(
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

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const documentType = (formData.get('documentType') as string) || undefined;

    if (!file) {
      return NextResponse.json(
        { success: false, error: '[VALIDATION_FAILED] No file uploaded in request' },
        { status: 400 }
      );
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

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: 'Document uploaded and processed successfully',
      },
      { status: 201 }
    );
  } catch (error: any) {
    const errMessage = error.message || 'Failed to process document upload';

    let status = 500;
    if (errMessage.includes('[FORBIDDEN]')) status = 403;
    else if (errMessage.includes('[REQUEST_NOT_FOUND]') || errMessage.includes('[USER_NOT_FOUND]')) status = 404;
    else if (errMessage.includes('[VALIDATION_FAILED]') || errMessage.includes('[STORAGE_ERROR]')) status = 400;

    return NextResponse.json(
      { success: false, error: errMessage },
      { status }
    );
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
