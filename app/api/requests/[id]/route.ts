import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getRequestTimeline } from '@/lib/workflows/service';
import { getCurrentAppUser } from '@/lib/auth/session';
import { canAccessRequest } from '@/lib/permissions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
      include: {
        student: true,
        workflow: true,
        department: true,
        assignedUser: true,
        requestData: true,
        tasks: { include: { assignee: true } },
        approvals: { include: { approver: true } },
        documents: true,
      },
    });

    if (!request) {
      return NextResponse.json(
        { success: false, error: `Request with ID "${params.id}" not found` },
        { status: 404 }
      );
    }

    // Security Rule: Enforce server-side access boundary
    if (!canAccessRequest(user, request.studentId, request.departmentId)) {
      return NextResponse.json(
        { success: false, error: '[FORBIDDEN] You do not have permission to view this request' },
        { status: 403 }
      );
    }

    const [timeline, { getWorkflowByKey, getWorkflowRequirements }] = await Promise.all([
      getRequestTimeline(params.id),
      import('@/lib/workflows/service'),
    ]);

    const workflowDefinition = getWorkflowByKey(request.workflow.key);
    const requirements = getWorkflowRequirements(request.workflow.key, request.currentStep);

    return NextResponse.json({
      success: true,
      data: {
        request,
        workflowDefinition,
        requirements,
        timeline,
        documents: request.documents || [],
      },
    });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch request details' },
      { status: 500 }
    );
  }
}
