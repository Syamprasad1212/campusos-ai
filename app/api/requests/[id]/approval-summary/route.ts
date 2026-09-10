import { NextResponse } from 'next/server';
import { getCurrentAppUser } from '@/lib/auth/session';
import { runApprovalAgent } from '@/lib/agents/approval-agent';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthenticated' }, { status: 401 });
    }

    const advisory = await runApprovalAgent(params.id, user);

    return NextResponse.json({
      success: true,
      data: advisory,
    });
  } catch (error: any) {
    const status = error.message.includes('[FORBIDDEN]') ? 403 : error.message.includes('[REQUEST_NOT_FOUND]') ? 404 : 500;
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate approval advisory' },
      { status }
    );
  }
}
