import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    system: 'CampusOS AI',
    stage: 'Stage 1 - Foundation Architecture',
    timestamp: new Date().toISOString(),
  });
}
