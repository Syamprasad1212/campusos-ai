import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createWorkflowRequest } from '@/lib/workflows/service';
import { getCurrentAppUser } from '@/lib/auth/session';
import { canAccessRequest } from '@/lib/permissions';

export async function GET(req: Request) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthenticated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status');

    const allRequests = await db.request.findMany({
      include: {
        student: true,
        workflow: true,
        department: true,
        requestData: true,
        tasks: { include: { assignee: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Filter requests based on server-side RBAC permissions
    let authorizedRequests = allRequests.filter((request) =>
      canAccessRequest(user, request.studentId, request.departmentId)
    );

    if (statusParam) {
      authorizedRequests = authorizedRequests.filter((r) => r.status === statusParam);
    }

    return NextResponse.json({
      success: true,
      data: authorizedRequests,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch requests' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthenticated' },
        { status: 401 }
      );
    }

    const body = await req.json();

    // Security Rule: Overwrite requesterId with authenticated user ID
    // Do NOT trust client-provided requesterId or role!
    const createInput = {
      ...body,
      requesterId: user.id,
    };

    const result = await createWorkflowRequest(createInput);

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: 'Request created successfully',
      },
      { status: 201 }
    );
  } catch (error: any) {
    const message = error.message || 'Failed to create workflow request';
    const isValidation = message.includes('[VALIDATION_FAILED]') || message.includes('[WORKFLOW_NOT_FOUND]');
    
    return NextResponse.json(
      { success: false, error: message },
      { status: isValidation ? 400 : 500 }
    );
  }
}
