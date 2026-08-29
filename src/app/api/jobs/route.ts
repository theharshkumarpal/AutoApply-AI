import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { scrapeGreenhouse, scrapeLever, scrapeLinkedInJobs, scrapeFallbackWeb } from '@/lib/scrapers/careerScraper';
import { enrichJobDetails, calculateAtsMatchScore } from '@/lib/ai/huggingface';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    let customCompany: string | null = null;
    let customPlatform: string | null = null;
    let customLocation: string | null = null;

    try {
      const body = await req.json();
      if (body?.company) customCompany = body.company.trim().toLowerCase();
      if (body?.platform) customPlatform = body.platform;
      if (body?.location) customLocation = body.location.trim();
    } catch {
      // Default trigger
    }

    let scrapedJobsForCompany: any[] = [];

    if (customCompany || customLocation) {
      const companyQuery = customCompany || '';
      const cleanToken = companyQuery.replace(/\s+/g, '');
      const formattedName = companyQuery ? companyQuery.charAt(0).toUpperCase() + companyQuery.slice(1) : '';

      // 1. Try Greenhouse API
      if (cleanToken && (!customPlatform || customPlatform === 'Greenhouse' || customPlatform === 'ALL')) {
        const ghJobs = await scrapeGreenhouse(cleanToken, formattedName);
        scrapedJobsForCompany = scrapedJobsForCompany.concat(ghJobs);
      }

      // 2. Try Lever API
      if (cleanToken && (!customPlatform || customPlatform === 'Lever' || customPlatform === 'ALL') && scrapedJobsForCompany.length === 0) {
        const leverJobs = await scrapeLever(cleanToken);
        scrapedJobsForCompany = scrapedJobsForCompany.concat(leverJobs);
      }

      // 3. Try Direct LinkedIn Public Job Postings Scraper (with Company and/or Location Search)
      if (scrapedJobsForCompany.length === 0) {
        const linkedInJobs = await scrapeLinkedInJobs(companyQuery, customLocation || undefined);
        scrapedJobsForCompany = scrapedJobsForCompany.concat(linkedInJobs);
      }

      // 4. Fallback Web Scraper with strict generic landing page filter
      if (scrapedJobsForCompany.length === 0) {
        const fallbackJobs = await scrapeFallbackWeb(companyQuery, customLocation || undefined);
        scrapedJobsForCompany = scrapedJobsForCompany.concat(fallbackJobs);
      }
    } else {
      // Default initial scrape set
      const greenhouseCompanies = [
        { token: 'stripe', name: 'Stripe' },
        { token: 'cloudflare', name: 'Cloudflare' },
        { token: 'github', name: 'GitHub' },
      ];
      const leverCompanies = ['figma', 'linear'];

      for (const comp of greenhouseCompanies) {
        const jobs = await scrapeGreenhouse(comp.token, comp.name);
        scrapedJobsForCompany = scrapedJobsForCompany.concat(jobs);
      }
      for (const company of leverCompanies) {
        const jobs = await scrapeLever(company);
        scrapedJobsForCompany = scrapedJobsForCompany.concat(jobs);
      }
    }

    // Filter by location if custom location specified
    if (customLocation && customLocation.toLowerCase() !== 'all') {
      const locTerm = customLocation.toLowerCase();
      const filtered = scrapedJobsForCompany.filter((j) =>
        (j.location || '').toLowerCase().includes(locTerm)
      );
      if (filtered.length > 0) {
        scrapedJobsForCompany = filtered;
      }
    }

    // Fetch candidate resume summary for ATS scoring
    const profile = await prisma.profile.findFirst();
    const resumeText = profile?.resumeSummary || 'Full Stack Software Engineer React Next.js TypeScript Node.js Python';

    // Limit to top 20 jobs for fast execution
    const targetJobs = scrapedJobsForCompany.slice(0, 20);

    // Save into DB with Enriched Details in parallel
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
          },
        });
      })
    );

    return NextResponse.json({
      success: true,
      message: `Scraped and enriched ${savedJobs.length} job openings!`,
      count: savedJobs.length,
    });
  } catch (error: any) {
    console.error('[API Scrape Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const jobs = await prisma.job.findMany({
      orderBy: { postedAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ success: true, jobs });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
