import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getRequestTimeline, getWorkflowByKey, getWorkflowRequirements } from '@/lib/workflows/service';
import { createSignedDocumentUrl } from '@/lib/storage/documents';
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
        tasks: {
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            assignee: { select: { name: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        approvals: {
          select: {
            id: true,
            status: true,
            comments: true,
            createdAt: true,
            approver: { select: { name: true, role: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
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

    const workflowDefinition = getWorkflowByKey(request.workflow.key);
    const requirements = getWorkflowRequirements(request.workflow.key, request.currentStep);

    // Parallelize timeline generation and document signed URLs concurrently
    const [timeline, documentsWithSignedUrls] = await Promise.all([
      getRequestTimeline(params.id, {
        tasks: request.tasks,
        approvals: request.approvals,
      }),
      Promise.all(
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
      ),
    ]);

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
