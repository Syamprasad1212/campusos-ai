import { NextResponse } from 'next/server';
import { getCurrentAppUser } from '@/lib/auth/session';

export async function GET() {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json({ success: false, data: null }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch user session' },
      { status: 500 }
    );
  }
}
