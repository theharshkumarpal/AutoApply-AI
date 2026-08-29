import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ScrapedJob {
  title: string;
  company: string;
  location: string;
  type: string;
  url: string;
  platform: 'Greenhouse' | 'Lever' | 'Direct Careers' | 'General Web';
  description: string;
}

// Helper function to scrape full detailed job page text if description is short
async function fetchFullPageContent(jobUrl: string): Promise<string> {
  try {
    const res = await axios.get(jobUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 5000,
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
      timeout: 10000,
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
      timeout: 10000,
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
      timeout: 12000,
    });

    const $ = cheerio.load(res.data);
    const jobs: ScrapedJob[] = [];

    const jobElements = $('.jobs-search__results-list li').toArray().slice(0, 20);

    for (const el of jobElements) {
      const title = $(el).find('.base-search-card__title').text().trim();
      const comp = $(el).find('.base-search-card__subtitle').text().trim() || formattedCompany;
      const location = $(el).find('.job-search-card__location').text().trim() || locationQuery || 'Global / Unspecified';
      const link = $(el).find('a.base-card__full-link').attr('href') || '';

      const isGenericPage = /careers|jobs|login|about|working-here|privacy/i.test(title);

      if (title && link && !isGenericPage) {
        // Fetch full page body content dynamically if link is valid
        let fullDescription = await fetchFullPageContent(link);
        if (!fullDescription || fullDescription.length < 50) {
          fullDescription = `Specific position: ${title} at ${comp}. Location: ${location}. Key requirements: ${title} expertise, industry experience, and leadership.`;
        }

        jobs.push({
          title,
          company: comp,
          location,
          type: 'Full-time',
          url: link,
          platform: 'Direct Careers',
          description: fullDescription,
        });
      }
    }

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
