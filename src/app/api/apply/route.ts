import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { runAutoApplyBot } from '@/lib/bot/autoApplyEngine';
import { generateCoverLetter } from '@/lib/ai/huggingface';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { jobId } = await req.json();

    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
    }

    // Retrieve candidate profile from database
    const profile = await prisma.profile.findFirst();
    if (!profile || !profile.fullName || !profile.email) {
      return NextResponse.json(
        { success: false, error: 'Candidate profile is incomplete or missing in database. Please complete your Candidate Profile first.' },
        { status: 400 }
      );
    }

    // Generate HuggingFace AI Cover Letter
    const coverLetter = await generateCoverLetter(profile.resumeSummary, job.title, job.company);

    const applicantData = {
      fullName: profile.fullName,
      email: profile.email,
      phone: profile.phone,
      linkedinUrl: profile.linkedinUrl,
      githubUrl: profile.githubUrl,
      portfolioUrl: profile.portfolioUrl,
      coverLetter,
    };

    // Run Playwright Bot
    const botResult = await runAutoApplyBot(job.url, applicantData, job.platform);

    // Record Application in DB
    const application = await prisma.application.create({
      data: {
        jobId: job.id,
        status: botResult.success ? 'SUBMITTED' : 'FAILED',
        logs: botResult.message,
      },
    });

    return NextResponse.json({
      success: botResult.success,
      application,
      botResult,
    });
  } catch (error: any) {
    console.error('[API Auto-Apply Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
