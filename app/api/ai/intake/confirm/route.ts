import { NextResponse } from 'next/server';
import { getCurrentAppUser } from '@/lib/auth/session';
import { toolCreateRequest, toolLogAgentRun } from '@/lib/agents/tools';

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
    const { workflowKey, data, title, summary } = body;

    if (!workflowKey || typeof workflowKey !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Request body must contain a valid "workflowKey"' },
        { status: 400 }
      );
    }

    // Security Rule: Enforce authenticated user identity
    const requestInput = {
      requesterId: user.id,
      workflowKey,
      title,
      summary,
      data: data || {},
    };

    const startTime = Date.now();
    const createdRequest = await toolCreateRequest(user, requestInput);

    // Log AgentRun for workflow confirmation
    await toolLogAgentRun({
      agentType: 'INTAKE_CONFIRM_AGENT',
      actorId: user.id,
      requestId: createdRequest.id,
      promptInput: `Confirmed workflow: ${workflowKey}`,
      aiOutputJson: JSON.parse(JSON.stringify({ requestId: createdRequest.id, referenceNo: createdRequest.referenceNo })),
      status: 'COMPLETED',
      executionTimeMs: Date.now() - startTime,
    });

    return NextResponse.json({
      success: true,
      data: createdRequest,
      message: 'Workflow request confirmed and submitted successfully',
    }, { status: 201 });
  } catch (error: any) {
    const message = error.message || 'Workflow confirmation failed';
    const isValidation = message.includes('[VALIDATION_FAILED]') || message.includes('[WORKFLOW_NOT_FOUND]');

    return NextResponse.json(
      { success: false, error: message },
      { status: isValidation ? 400 : 500 }
    );
  }
}
