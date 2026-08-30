import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { applicationId, jobId, status } = await req.json();

    if (!status) {
      return NextResponse.json({ success: false, error: 'Status is required' }, { status: 400 });
    }

    if (applicationId) {
      const updated = await prisma.application.update({
        where: { id: applicationId },
        data: { status },
        include: { job: true },
      });
      return NextResponse.json({ success: true, application: updated });
    }

    if (jobId) {
      // Check if application already exists for this job
      const existing = await prisma.application.findFirst({
        where: { jobId },
        include: { job: true },
      });

      if (existing) {
        const updated = await prisma.application.update({
          where: { id: existing.id },
          data: { status },
          include: { job: true },
        });
        return NextResponse.json({ success: true, application: updated });
      }

      // Create new application entry (e.g. SAVED)
      const created = await prisma.application.create({
        data: {
          jobId,
          status,
          logs: `Job bookmarked as ${status} in candidate pipeline`,
        },
        include: { job: true },
      });
      return NextResponse.json({ success: true, application: created });
    }

    return NextResponse.json({ success: false, error: 'Application ID or Job ID required' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
