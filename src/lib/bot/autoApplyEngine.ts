import { chromium } from 'playwright';

export interface ApplicantProfile {
  fullName: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl?: string;
  coverLetter?: string;
}

export async function runAutoApplyBot(jobUrl: string, applicant: ApplicantProfile, platform: string) {
  let browser = null;
  try {
    // Launch Chrome binary
    browser = await chromium.launch({
      headless: true, // Set to false to see browser UI while debugging locally
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    
    const page = await context.newPage();
    console.log(`[Bot] Navigating to ${platform} job application: ${jobUrl}`);
    await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const nameParts = applicant.fullName.split(' ');
    const firstName = nameParts[0] || applicant.fullName;
    const lastName = nameParts.slice(1).join(' ') || 'Candidate';

    // Form filling heuristics
    if (platform === 'Greenhouse' || jobUrl.includes('greenhouse.io')) {
      if (await page.$('#first_name')) await page.fill('#first_name', firstName);
      if (await page.$('#last_name')) await page.fill('#last_name', lastName);
      if (await page.$('#email')) await page.fill('#email', applicant.email);
      if (await page.$('#phone')) await page.fill('#phone', applicant.phone);

      const linkedinInput = await page.$('input[aria-label*="LinkedIn"], input[id*="linkedin"], input[name*="linkedin"]');
      if (linkedinInput) await linkedinInput.fill(applicant.linkedinUrl);

      const githubInput = await page.$('input[aria-label*="GitHub"], input[id*="github"], input[name*="github"]');
      if (githubInput) await githubInput.fill(applicant.githubUrl);

      if (applicant.coverLetter && (await page.$('#cover_letter_text'))) {
        await page.fill('#cover_letter_text', applicant.coverLetter);
      }
    } else if (platform === 'Lever' || jobUrl.includes('lever.co')) {
      if (await page.$('input[name="name"]')) await page.fill('input[name="name"]', applicant.fullName);
      if (await page.$('input[name="email"]')) await page.fill('input[name="email"]', applicant.email);
      if (await page.$('input[name="phone"]')) await page.fill('input[name="phone"]', applicant.phone);
      if (await page.$('input[name="urls[LinkedIn]"]')) await page.fill('input[name="urls[LinkedIn]"]', applicant.linkedinUrl);
      if (await page.$('input[name="urls[GitHub]"]')) await page.fill('input[name="urls[GitHub]"]', applicant.githubUrl);

      if (applicant.coverLetter && (await page.$('textarea[name="comments"]'))) {
        await page.fill('textarea[name="comments"]', applicant.coverLetter);
      }
    }

    console.log(`[Bot] Successfully populating fields for ${jobUrl}`);
    await page.waitForTimeout(2000);
    await browser.close();

    return {
      success: true,
      message: `Form populated successfully for ${applicant.fullName}.`,
    };
  } catch (error: any) {
    if (browser) await browser.close();
    console.error(`[Bot Error] Failed to process ${jobUrl}:`, error);
    return {
      success: false,
      error: error.message || 'Execution failed',
    };
  }
}
