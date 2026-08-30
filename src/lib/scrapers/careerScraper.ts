import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ScrapedJob {
  title: string;
  company: string;
  location: string;
  type: string;
  url: string;
  platform: 'Greenhouse' | 'Lever' | 'Direct Careers' | 'General Web' | 'Remotive' | 'Arbeitnow';
  description: string;
}

// Helper function to scrape full detailed job page text if description is short
async function fetchFullPageContent(jobUrl: string): Promise<string> {
  try {
    const res = await axios.get(jobUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 2000,
    });
    const $ = cheerio.load(res.data);

    // Remove scripts, styles, header, footer navs
    $('script, style, nav, footer, header').remove();

    // Extract text from main job posting containers
    const pageText = $('main, article, .job-description, .posting-page, #job-description, body')
      .text()
      .replace(/\s+/g, ' ')
      .trim();

    return pageText.slice(0, 2500);
  } catch {
    return '';
  }
}

// 1. Greenhouse Career Board Scraper (JSON API)
export async function scrapeGreenhouse(boardToken: string, companyName: string): Promise<ScrapedJob[]> {
  try {
    const res = await axios.get(`https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`, {
      timeout: 5000,
    });
    
    if (!res.data || !res.data.jobs) return [];

    return res.data.jobs.map((job: any) => ({
      title: job.title,
      company: companyName,
      location: job.location?.name || 'Remote / Unspecified',
      type: 'Full-time',
      url: job.absolute_url,
      platform: 'Greenhouse',
      description: (job.content || '').replace(/<[^>]*>?/gm, ''),
    }));
  } catch (error) {
    return [];
  }
}

// 2. Lever Career Portal Scraper (JSON API)
export async function scrapeLever(companyName: string): Promise<ScrapedJob[]> {
  try {
    const res = await axios.get(`https://api.lever.co/v0/postings/${companyName}?mode=json`, {
      timeout: 5000,
    });
    
    if (!Array.isArray(res.data)) return [];

    return res.data.map((job: any) => ({
      title: job.text,
      company: companyName,
      location: job.categories?.location || 'Remote',
      type: job.categories?.commitment || 'Full-time',
      url: job.hostedUrl,
      platform: 'Lever',
      description: job.descriptionPlain || '',
    }));
  } catch (error) {
    return [];
  }
}

// 3. Robust LinkedIn Public Job Postings Scraper (Company + Location Search)
export async function scrapeLinkedInJobs(companyName: string, locationQuery?: string): Promise<ScrapedJob[]> {
  try {
    const formattedCompany = companyName ? companyName.charAt(0).toUpperCase() + companyName.slice(1) : 'Target Company';
    const locParam = locationQuery ? `&location=${encodeURIComponent(locationQuery)}` : '';
    const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(companyName || 'software')}${locParam}`;
    
    const res = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 5000,
    });

    const $ = cheerio.load(res.data);

    const rawElements = $('.jobs-search__results-list li').toArray().slice(0, 10);

    const jobs = (
      await Promise.all(
        rawElements.map(async (el) => {
          const title = $(el).find('.base-search-card__title').text().trim();
          const comp = $(el).find('.base-search-card__subtitle').text().trim() || formattedCompany;
          const location = $(el).find('.job-search-card__location').text().trim() || locationQuery || 'Global / Unspecified';
          const link = $(el).find('a.base-card__full-link').attr('href') || '';

          const isGenericPage = /careers|jobs|login|about|working-here|privacy/i.test(title);

          if (!title || !link || isGenericPage) return null;

          let fullDescription = await fetchFullPageContent(link);
          if (!fullDescription || fullDescription.length < 50) {
            fullDescription = `Specific position: ${title} at ${comp}. Location: ${location}. Key requirements: ${title} expertise, industry experience, and leadership.`;
          }

          return {
            title,
            company: comp,
            location,
            type: 'Full-time',
            url: link,
            platform: 'Direct Careers' as const,
            description: fullDescription,
          };
        })
      )
    ).filter(Boolean) as ScrapedJob[];

    return jobs;
  } catch (err) {
    console.error(`[LinkedIn Scraper Error]:`, err);
    return [];
  }
}

// 4. Fallback Web Scraper (DuckDuckGo HTML) with Company & Location Search
export async function scrapeFallbackWeb(query: string, locationQuery?: string): Promise<ScrapedJob[]> {
  try {
    const locString = locationQuery ? ` in ${locationQuery}` : '';
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query + locString + ' job posting apply')}`;
    const res = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      timeout: 10000,
    });

    const $ = cheerio.load(res.data);
    const jobs: ScrapedJob[] = [];
    const formattedCompany = query ? query.charAt(0).toUpperCase() + query.slice(1) : 'Company';

    $('.result__body').each((i, el) => {
      if (i >= 20) return;

      const rawTitle = $(el).find('.result__title').text().trim();
      const rawLink = $(el).find('.result__url').attr('href') || $(el).find('a.result__title').attr('href') || '';
      const snippet = $(el).find('.result__snippet').text().trim();

      if (rawTitle && rawLink) {
        let finalUrl = rawLink;
        if (rawLink.includes('uddg=')) {
          const match = rawLink.match(/uddg=([^&]+)/);
          if (match) finalUrl = decodeURIComponent(match[1]);
        }

        if (finalUrl.startsWith('//')) {
          finalUrl = 'https:' + finalUrl;
        }

        const isGenericPage = /^(careers|life at|working at|jobs at|home|about us|our culture)/i.test(rawTitle) ||
          finalUrl.endsWith('/careers') || finalUrl.endsWith('/jobs') || finalUrl.endsWith('/careers/');

        if (isGenericPage) return;

        const platform = finalUrl.includes('greenhouse')
          ? 'Greenhouse'
          : finalUrl.includes('lever')
          ? 'Lever'
          : 'Direct Careers';

        const cleanTitle = rawTitle
          .replace(/ - Greenhouse| - Lever| Job Application| Careers| LinkedIn| Indeed.com| Naukri.com/gi, '')
          .replace(/\|.*/, '')
          .trim();

        if (cleanTitle) {
          jobs.push({
            title: cleanTitle,
            company: formattedCompany,
            location: locationQuery || (snippet.toLowerCase().includes('remote') ? 'Remote' : 'Global / Various Locations'),
            type: 'Full-time',
            url: finalUrl,
            platform,
            description: snippet || `Official job posting for ${cleanTitle} at ${formattedCompany}.`,
          });
        }
      }
    });

    return jobs;
  } catch (err) {
    console.error(`[Fallback Scraper Error]:`, err);
    return [];
  }
}

// ═══════════════════════════════════════════════════
// ROLE-BASED SEARCH SCRAPERS (search by job title across many companies)
// ═══════════════════════════════════════════════════

// 5. Remotive.com — Free Remote Jobs API (search by role)
export async function scrapeRemotive(roleQuery: string, limit: number = 20): Promise<ScrapedJob[]> {
  try {
    const res = await axios.get('https://remotive.com/api/remote-jobs', {
      params: { search: roleQuery, limit },
      timeout: 8000,
    });

    const jobs = res.data?.jobs;
    if (!Array.isArray(jobs)) return [];

    return jobs.map((job: any) => ({
      title: job.title || '',
      company: job.company_name || 'Unknown Company',
      location: job.candidate_required_location || 'Remote',
      type: job.job_type || 'Full-time',
      url: job.url || '',
      platform: 'Remotive' as const,
      description: (job.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2500),
    })).filter((j: ScrapedJob) => j.title && j.url);
  } catch (err) {
    console.error('[Remotive Scraper Error]:', err);
    return [];
  }
}

// 6. Arbeitnow.com — Free Job Board API (search by role, filters by tag)
export async function scrapeArbeitnow(roleQuery: string, limit: number = 20): Promise<ScrapedJob[]> {
  try {
    const res = await axios.get('https://www.arbeitnow.com/api/job-board-api', {
      timeout: 8000,
    });

    const allJobs = res.data?.data;
    if (!Array.isArray(allJobs)) return [];

    // Filter by role query (title match or tag match)
    const queryTerms = roleQuery.toLowerCase().split(/\s+/);
    const matched = allJobs.filter((job: any) => {
      const title = (job.title || '').toLowerCase();
      const tags = Array.isArray(job.tags) ? job.tags.join(' ').toLowerCase() : '';
      const desc = (job.description || '').toLowerCase();
      return queryTerms.some(term => title.includes(term) || tags.includes(term) || desc.includes(term));
    });

    return matched.slice(0, limit).map((job: any) => ({
      title: job.title || '',
      company: job.company_name || 'Unknown Company',
      location: job.location || 'Remote / Flexible',
      type: job.remote ? 'Remote' : 'Full-time',
      url: `https://www.arbeitnow.com/jobs/${job.slug}`,
      platform: 'Arbeitnow' as const,
      description: (job.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2500),
    })).filter((j: ScrapedJob) => j.title && j.url);
  } catch (err) {
    console.error('[Arbeitnow Scraper Error]:', err);
    return [];
  }
}

// 7. Combined Role-Based Search (aggregates all sources in parallel)
export async function scrapeByRole(roleQuery: string, locationQuery?: string): Promise<ScrapedJob[]> {
  const [remotiveJobs, arbeitnowJobs, linkedInJobs, webJobs] = await Promise.all([
    scrapeRemotive(roleQuery, 15),
    scrapeArbeitnow(roleQuery, 15),
    scrapeLinkedInJobs(roleQuery, locationQuery),
    scrapeFallbackWeb(`${roleQuery} ${locationQuery || ''}`.trim(), locationQuery),
  ]);

  let combined = [...remotiveJobs, ...arbeitnowJobs, ...linkedInJobs, ...webJobs];

  // Deduplicate by URL
  const seen = new Set<string>();
  combined = combined.filter(job => {
    if (seen.has(job.url)) return false;
    seen.add(job.url);
    return true;
  });

  // Filter by location if provided
  if (locationQuery && locationQuery.toLowerCase() !== 'all') {
    const locTerm = locationQuery.toLowerCase();
    const locationFiltered = combined.filter(j =>
      (j.location || '').toLowerCase().includes(locTerm)
    );
    // Only apply filter if it doesn't eliminate everything
    if (locationFiltered.length > 0) {
      combined = locationFiltered;
    }
  }

  return combined.slice(0, 40);
}
