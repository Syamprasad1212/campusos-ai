import { NextResponse } from 'next/server';
import { getCurrentAppUser } from '@/lib/auth/session';
import { runIntakeAgent } from '@/lib/agents/intake-agent';

export async function POST(req: Request) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: '[UNAUTHORIZED] Authenticated session required' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { message, conversationContext } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Request body must contain a valid "message" string' },
        { status: 400 }
      );
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
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'AI Intake agent processing failed' },
      { status: 500 }
    );
  }
}
