import { NextResponse } from 'next/server';
import { getCurrentAppUser } from '@/lib/auth/session';
import { getUserNotifications } from '@/lib/notifications/service';

export async function GET() {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthenticated' }, { status: 401 });
    }

    const data = await getUserNotifications(user.id);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}
