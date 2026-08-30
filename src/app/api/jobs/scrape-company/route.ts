import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const FASTAPI_BASE = process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000';

export async function POST(req: Request) {
  try {
    const { companyName, query } = await req.json();

    if (!companyName || !companyName.trim()) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid company name to search career pages.' },
        { status: 400 }
      );
    }

    const cleanCompany = companyName.trim();
    let scrapedJobs: any[] = [];

    // 1. Proxy to FastAPI /api/ai/scrape-company-careers
    try {
      const res = await fetch(`${FASTAPI_BASE}/api/ai/scrape-company-careers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: cleanCompany, query: query || '' }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.jobs && Array.isArray(data.jobs)) {
          scrapedJobs = data.jobs;
        }
      }
    } catch (err) {
      console.warn('[Scrape Company Route Notice] FastAPI backend offline, using fallback ATS fetcher');
    }

    // 2. TypeScript fallback for Greenhouse/Lever public ATS APIs if FastAPI is offline
    if (scrapedJobs.length === 0) {
      const slug = cleanCompany.toLowerCase().replace(/[^a-z0-9]/g, '');

      // Try Greenhouse public API
      try {
        const ghRes = await fetch(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`);
        if (ghRes.ok) {
          const ghData = await ghRes.json();
          if (ghData.jobs && Array.isArray(ghData.jobs)) {
            for (const j of ghData.jobs.slice(0, 20)) {
              scrapedJobs.push({
                title: j.title || 'Position',
                company: cleanCompany,
                location: j.location?.name || 'Remote',
                type: 'Full-time',
                url: j.absolute_url || `https://boards.greenhouse.io/${slug}/jobs/${j.id}`,
                platform: 'Greenhouse',
                description: j.content ? j.content.replace(/<[^>]*>/g, '').slice(0, 1500) : `Opening for ${j.title} at ${cleanCompany}.`,
                reqSkills: j.title,
                postedAt: 'Just now',
              });
            }
          }
        }
      } catch (err) {}

      // Try Lever public API if Greenhouse empty
      if (scrapedJobs.length === 0) {
        try {
          const leverRes = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`);
          if (leverRes.ok) {
            const leverData = await leverRes.json();
            if (Array.isArray(leverData)) {
              for (const j of leverData.slice(0, 20)) {
                scrapedJobs.push({
                  title: j.text || 'Position',
                  company: cleanCompany,
                  location: j.categories?.location || 'Remote',
                  type: 'Full-time',
                  url: j.hostedUrl || '',
                  platform: 'Lever',
                  description: j.descriptionPlain ? j.descriptionPlain.slice(0, 1500) : `Opening for ${j.text} at ${cleanCompany}.`,
                  reqSkills: j.text,
                  postedAt: 'Just now',
                });
              }
            }
          }
        } catch (err) {}
      }
    }

    if (scrapedJobs.length === 0) {
      return NextResponse.json({
        success: false,
        message: `No public career page openings found for "${cleanCompany}". Try another company name like Figma, Stripe, Vercel, or Ericsson.`,
        jobs: [],
      });
    }

    // Retrieve candidate profile preferences for match scoring
    const profile = await prisma.profile.findFirst();
    const candidateSkills = profile?.skills ? profile.skills.toLowerCase().split(',').map((s) => s.trim()) : [];
    const candidatePrefs = profile?.jobPreferences ? profile.jobPreferences.toLowerCase() : '';

    // 3. Upsert scraped jobs into PostgreSQL via Prisma
    const savedJobs = [];
    for (const item of scrapedJobs) {
      if (!item.url) continue;

      // Compute match score
      let matchScore = 70;
      const fullText = (item.title + ' ' + item.description + ' ' + item.reqSkills).toLowerCase();
      let matchedCount = 0;

      for (const skill of candidateSkills) {
        if (skill && fullText.includes(skill)) {
          matchedCount++;
        }
      }

      if (candidateSkills.length > 0) {
        const ratio = matchedCount / candidateSkills.length;
        matchScore = Math.min(Math.max(Math.round(ratio * 50 + 45), 55), 98);
      }

      if (candidatePrefs && (fullText.includes('senior') || fullText.includes('engineer') || fullText.includes('remote'))) {
        matchScore = Math.min(matchScore + 5, 98);
      }

      const cleanDesc = (item.description || '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const upsertedJob = await prisma.job.upsert({
        where: { url: item.url },
        update: {
          title: item.title,
          company: item.company,
          location: item.location,
          type: item.type,
          platform: item.platform,
          description: cleanDesc,
          reqSkills: item.reqSkills,
          matchScore: matchScore,
        },
        create: {
          title: item.title,
          company: item.company,
          location: item.location,
          type: item.type,
          platform: item.platform,
          url: item.url,
          description: cleanDesc,
          cleanSummary: cleanDesc.slice(0, 300),
          reqSkills: item.reqSkills,
          minExp: '2+ years',
          salaryRange: 'Competitive',
          postedAt: new Date(),
          matchScore: matchScore,
        },
      });

      savedJobs.push(upsertedJob);
    }

    return NextResponse.json({
      success: true,
      company: cleanCompany,
      totalFound: savedJobs.length,
      jobs: savedJobs,
    });
  } catch (error: any) {
    console.error('[Scrape Company API Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
