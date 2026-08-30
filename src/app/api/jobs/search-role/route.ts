import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { scrapeByRole } from '@/lib/scrapers/careerScraper';
import { enrichJobDetails, calculateAtsMatchScore } from '@/lib/ai/huggingface';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const role = (body?.role || '').trim();
    const location = (body?.location || '').trim();

    if (!role) {
      return NextResponse.json({ success: false, error: 'Role query is required' }, { status: 400 });
    }

    // Scrape from multiple job boards by role title in parallel
    const scrapedJobs = await scrapeByRole(role, location || undefined);

    if (scrapedJobs.length === 0) {
      return NextResponse.json({
        success: true,
        message: `No openings found for "${role}"${location ? ` in ${location}` : ''}. Try a broader role title.`,
        count: 0,
      });
    }

    // Fetch candidate profile for ATS scoring
    const profile = await prisma.profile.findFirst();
    const resumeText = profile?.resumeSummary || profile?.skills || '';

    // Enrich and save jobs in parallel (limit to 30 for speed)
    const targetJobs = scrapedJobs.slice(0, 30);

    const savedJobs = await Promise.all(
      targetJobs.map(async (job) => {
        const enriched = await enrichJobDetails(job.title, job.company, job.description);
        const matchScore = await calculateAtsMatchScore(resumeText, job.description);

        return prisma.job.upsert({
          where: { url: job.url },
          update: {
            cleanSummary: enriched.cleanSummary,
            reqSkills: enriched.reqSkills,
            minExp: enriched.minExp,
            salaryRange: enriched.salaryRange,
            refinedDescription: enriched.refinedDescription,
            matchScore,
          },
          create: {
            title: job.title,
            company: job.company,
            location: job.location,
            type: job.type,
            url: job.url,
            platform: job.platform,
            description: job.description,
            cleanSummary: enriched.cleanSummary,
            reqSkills: enriched.reqSkills,
            minExp: enriched.minExp,
            salaryRange: enriched.salaryRange,
            refinedDescription: enriched.refinedDescription,
            matchScore,
            postedAt: new Date(),
          },
        });
      })
    );

    return NextResponse.json({
      success: true,
      message: `Found ${savedJobs.length} "${role}" openings across ${new Set(savedJobs.map(j => j.company)).size} companies!`,
      count: savedJobs.length,
    });
  } catch (error: any) {
    console.error('[Role Search API Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
