import { NextResponse } from 'next/server';
import { getAuthorizedDocumentUrl } from '@/lib/documents/service';
import { getCurrentAppUser } from '@/lib/auth/session';

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

    const result = await getAuthorizedDocumentUrl(params.id, user);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    const errMessage = error.message || 'Failed to fetch document';
    let status = 500;
    if (errMessage.includes('[FORBIDDEN]')) status = 403;
    else if (errMessage.includes('[DOCUMENT_NOT_FOUND]')) status = 404;

    return NextResponse.json(
      { success: false, error: errMessage },
      { status }
    );
  }
}
