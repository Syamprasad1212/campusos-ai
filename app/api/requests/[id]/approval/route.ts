import { NextResponse } from 'next/server';
import { getCurrentAppUser } from '@/lib/auth/session';
import { executeWorkflowAction } from '@/lib/workflows/service';

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthenticated' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, reason } = body;

    if (!action || (action !== 'APPROVE' && action !== 'REJECT')) {
      return NextResponse.json(
        { success: false, error: 'Invalid approval action. Must be "APPROVE" or "REJECT".' },
        { status: 400 }
      );
    }

    const updatedRequest = await executeWorkflowAction({
      requestId: params.id,
      actorId: user.id,
      action,
      reason,
    });

    return NextResponse.json({
      success: true,
      data: updatedRequest,
    });
  } catch (error: any) {
    const status = error.message.includes('[FORBIDDEN]')
      ? 403
      : error.message.includes('[VALIDATION_FAILED]')
      ? 400
      : error.message.includes('[REQUEST_NOT_FOUND]')
      ? 404
      : 500;

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process approval action' },
      { status }
    );
  }
}
