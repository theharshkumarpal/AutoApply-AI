import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const applications = await prisma.application.findMany({
      include: {
        job: true,
      },
      orderBy: { appliedAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ success: true, applications });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
