import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const FASTAPI_BASE = process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000';

export async function POST(req: Request) {
  try {
    const { jobId } = await req.json();

    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
    }

    const profile = await prisma.profile.findFirst();
    const resumeText = profile?.resumeSummary || profile?.skills || '';

    // Call FastAPI service if online
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${FASTAPI_BASE}/api/ai/ats-breakdown`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText,
          jobTitle: job.title,
          company: job.company,
          jobDescription: job.description,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({ success: true, breakdown: data });
      }
    } catch (err) {
      // Fallback below
    }

    // Fallback TS ATS Match Analysis
    const jobSkills = job.reqSkills ? job.reqSkills.split(',').map((s) => s.trim()).filter(Boolean) : [job.title];
    const candidateSkillsStr = (profile?.skills || '').toLowerCase();
    const candidateSummaryStr = (profile?.resumeSummary || '').toLowerCase();

    const matched: string[] = [];
    const missing: string[] = [];

    jobSkills.forEach((skill) => {
      const skLower = skill.toLowerCase();
      if (candidateSkillsStr.includes(skLower) || candidateSummaryStr.includes(skLower)) {
        matched.push(skill);
      } else {
        missing.push(skill);
      }
    });

    const matchScore = job.matchScore || Math.min(Math.max(Math.round((matched.length / (jobSkills.length || 1)) * 60 + 40), 50), 98);

    const recommendations = [
      missing.length > 0 ? `Consider adding target technical keywords: ${missing.slice(0, 3).join(', ')}.` : 'Strong skill alignment detected!',
      `Ensure job title keywords for "${job.title}" are reflected in your candidate profile.`,
      'Highlight measurable impacts and achievements in your project descriptions.',
    ];

    const tailoredSummary = `Results-driven Software Engineer with expertise in ${jobSkills.slice(0, 4).join(', ')}, delivering high-performance applications for ${job.title} roles at ${job.company}.`;

    return NextResponse.json({
      success: true,
      breakdown: {
        matchScore,
        matchedSkills: matched,
        missingSkills: missing,
        recommendations,
        tailoredSummary,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
