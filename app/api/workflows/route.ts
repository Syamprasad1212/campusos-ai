import { NextResponse } from 'next/server';
import { listActiveWorkflows } from '@/lib/workflows/definitions';

export async function GET() {
  const workflows = listActiveWorkflows();
  return NextResponse.json({
    success: true,
    data: workflows,
  });
}
