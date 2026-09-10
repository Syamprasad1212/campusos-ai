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

    const [timeline, { getWorkflowByKey, getWorkflowRequirements }, { createSignedDocumentUrl }] = await Promise.all([
      getRequestTimeline(params.id),
      import('@/lib/workflows/service'),
      import('@/lib/storage/documents'),
    ]);

    const workflowDefinition = getWorkflowByKey(request.workflow.key);
    const requirements = getWorkflowRequirements(request.workflow.key, request.currentStep);

    // Generate signed download/view URLs for all attached documents
    const documentsWithSignedUrls = await Promise.all(
      (request.documents || []).map(async (doc) => {
        let signedUrl = '';
        try {
          signedUrl = await createSignedDocumentUrl(doc.storageReference || doc.fileUrl, 3600);
        } catch {
          signedUrl = doc.fileUrl;
        }
        return {
          ...doc,
          signedUrl,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        request: {
          ...request,
          documents: documentsWithSignedUrls,
        },
        workflowDefinition,
        requirements,
        timeline,
        documents: documentsWithSignedUrls,
      },
    });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch request details' },
      { status: 500 }
    );
  }
}
