import { NextResponse } from 'next/server';
import { getWorkflowByKey } from '@/lib/workflows/definitions';

export async function GET(
  request: Request,
  { params }: { params: { key: string } }
) {
  const workflow = getWorkflowByKey(params.key);

  if (!workflow) {
    return NextResponse.json(
      { success: false, error: `Workflow with key "${params.key}" not found` },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: workflow,
  });
}
