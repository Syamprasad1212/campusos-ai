import { NextResponse } from 'next/server';
import { verifyDocumentByStaff } from '@/lib/documents/service';
import { getCurrentAppUser } from '@/lib/auth/session';

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

    const body = await req.json();
    const { status, reason } = body;

    if (!status || (status !== 'VERIFIED' && status !== 'REJECTED')) {
      return NextResponse.json(
        { success: false, error: '[VALIDATION_FAILED] Verification status must be VERIFIED or REJECTED' },
        { status: 400 }
      );
    }

    const result = await verifyDocumentByStaff({
      documentId: params.id,
      actorId: user.id,
      status,
      reason,
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: `Document status updated to ${status}`,
    });
  } catch (error: any) {
    const errMessage = error.message || 'Failed to verify document';
    let httpStatus = 500;
    if (errMessage.includes('[FORBIDDEN]')) httpStatus = 403;
    else if (errMessage.includes('[DOCUMENT_NOT_FOUND]') || errMessage.includes('[USER_NOT_FOUND]')) httpStatus = 404;
    else if (errMessage.includes('[VALIDATION_FAILED]')) httpStatus = 400;

    return NextResponse.json(
      { success: false, error: errMessage },
      { status: httpStatus }
    );
  }
}
