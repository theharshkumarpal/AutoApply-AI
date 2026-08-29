const FASTAPI_BASE = process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000';

export interface EnrichedJobDetails {
  cleanSummary: string;
  reqSkills: string;
  minExp: string;
  salaryRange: string;
}

export async function enrichJobDetails(jobTitle: string, company: string, description: string): Promise<EnrichedJobDetails> {
  try {
    const res = await fetch(`${FASTAPI_BASE}/api/ai/enrich-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobTitle, company, description }),
    });

    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (err) {
    console.error('[FastAPI Enrich Error]:', err);
  }

  // Fallback - be honest about missing enrichment
  return {
    cleanSummary: `• Responsibilities: See full description for ${jobTitle} at ${company}\n• Requirements: Review posting for skill details\n• Scope: Position details pending enrichment`,
    reqSkills: jobTitle,
    minExp: 'See Posting',
    salaryRange: 'See Posting',
  };
}

export async function calculateAtsMatchScore(resumeText: string, jobDescription: string): Promise<number> {
  try {
    const res = await fetch(`${FASTAPI_BASE}/api/ai/match-score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeText, jobDescription }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.matchScore ?? 78;
    }
  } catch (err) {
    console.error('[FastAPI Match Score Error]:', err);
  }

  return 78;
}

export async function generateCoverLetter(resumeText: string, jobTitle: string, company: string): Promise<string> {
  try {
    const res = await fetch(`${FASTAPI_BASE}/api/ai/cover-letter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeText, jobTitle, company }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.coverLetter;
    }
  } catch (err) {
    console.error('[FastAPI Cover Letter Error]:', err);
  }

  return `Dear Hiring Manager at ${company},\n\nI am thrilled to submit my application for the ${jobTitle} role. With my engineering experience and technical problem solving, I look forward to contributing to your team.\n\nBest regards.`;
}
