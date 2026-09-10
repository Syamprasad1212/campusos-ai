import { NextResponse } from 'next/server';
import { executeWorkflowAction } from '@/lib/workflows/service';
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
    const { action, reason, message, field, value } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: '[VALIDATION_FAILED] Action name is required' },
        { status: 400 }
      );
    }

    const result = await executeWorkflowAction({
      requestId: params.id,
      actorId: user.id,
      action,
      reason,
      message,
      field,
      value,
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: `Action "${action}" executed successfully`,
    });
  } catch (error: any) {
    const errMessage = error.message || 'Failed to execute workflow action';

    let status = 500;
    if (errMessage.includes('[FORBIDDEN]')) status = 403;
    else if (errMessage.includes('[REQUEST_NOT_FOUND]') || errMessage.includes('[USER_NOT_FOUND]')) status = 404;
    else if (errMessage.includes('[VALIDATION_FAILED]') || errMessage.includes('[INVALID_ACTION]') || errMessage.includes('[INVALID_STEP]')) status = 400;

    return NextResponse.json(
      { success: false, error: errMessage },
      { status }
    );
  }
}
