import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const FASTAPI_BASE = process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000';

// ── Comprehensive skills dictionary for mining ──
const SKILLS_DICTIONARY = [
  // Languages
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'Ruby', 'PHP',
  'Swift', 'Kotlin', 'Scala', 'R', 'MATLAB', 'Perl', 'Dart', 'Lua', 'Haskell', 'Elixir',
  'Objective-C', 'Assembly', 'Shell', 'Bash', 'PowerShell', 'SQL', 'HTML', 'CSS', 'SASS', 'LESS',
  // Frontend
  'React', 'Next.js', 'Vue', 'Nuxt', 'Angular', 'Svelte', 'Tailwind', 'Bootstrap', 'jQuery',
  'Redux', 'Zustand', 'MobX', 'Webpack', 'Vite', 'Remix', 'Gatsby', 'Astro',
  // Backend
  'Node.js', 'Express', 'FastAPI', 'Django', 'Flask', 'Spring Boot', 'Rails', 'Laravel',
  'NestJS', 'Hono', 'Koa', 'Fastify', 'ASP.NET', 'GraphQL', 'REST', 'gRPC', 'tRPC',
  // Databases
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQLite', 'DynamoDB', 'Cassandra', 'Elasticsearch',
  'Supabase', 'Firebase', 'Prisma', 'Drizzle', 'Sequelize', 'Mongoose', 'Neo4j', 'CockroachDB',
  // Cloud & DevOps
  'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'Ansible', 'Jenkins', 'GitHub Actions',
  'CI/CD', 'Vercel', 'Netlify', 'Heroku', 'DigitalOcean', 'Cloudflare', 'Nginx', 'Apache',
  'Linux', 'Ubuntu', 'CentOS',
  // AI/ML
  'TensorFlow', 'PyTorch', 'Scikit-learn', 'Keras', 'OpenCV', 'NLP', 'LLM', 'Hugging Face',
  'LangChain', 'RAG', 'Transformers', 'Pandas', 'NumPy', 'Matplotlib', 'Jupyter',
  'Machine Learning', 'Deep Learning', 'Computer Vision', 'Neural Networks',
  // Mobile
  'React Native', 'Flutter', 'SwiftUI', 'Jetpack Compose', 'Ionic', 'Expo',
  // Tools & Practices
  'Git', 'Jira', 'Figma', 'Agile', 'Scrum', 'TDD', 'Unit Testing', 'Jest', 'Cypress',
  'Playwright', 'Selenium', 'Storybook', 'Postman', 'Swagger',
  // Data & Analytics
  'Tableau', 'Power BI', 'Apache Spark', 'Kafka', 'Airflow', 'Hadoop', 'Snowflake', 'BigQuery',
  'ETL', 'Data Engineering', 'Data Science',
  // Security & Networking
  'OAuth', 'JWT', 'SSL/TLS', 'Penetration Testing', 'OWASP', 'Cryptography',
  // Blockchain
  'Solidity', 'Web3', 'Ethereum', 'Smart Contracts',
];

function mineSkills(text: string): string[] {
  const found = new Set<string>();
  const lowerText = text.toLowerCase();
  for (const skill of SKILLS_DICTIONARY) {
    // Word-boundary match (case-insensitive)
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(text) || lowerText.includes(skill.toLowerCase())) {
      found.add(skill);
    }
  }
  return Array.from(found);
}

function extractFullName(text: string): string {
  // Strategy: First non-empty line that looks like a name (2-4 capitalized words, no emails/urls/phone numbers)
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  for (const line of lines.slice(0, 10)) {
    // Skip lines with emails, URLs, phone numbers, or too many words
    if (/@/.test(line) || /https?:\/\//.test(line) || /\d{5,}/.test(line)) continue;
    if (line.length > 60 || line.length < 3) continue;
    // Check if it looks like a name: 2-4 words, mostly alphabetic
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 5) {
      const allAlpha = words.every(w => /^[A-Za-z.'-]+$/.test(w));
      const hasCapital = words.some(w => /^[A-Z]/.test(w));
      if (allAlpha && hasCapital) {
        return line;
      }
    }
  }
  return '';
}

function extractLinkedIn(text: string): string {
  const match = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+/i);
  return match ? (match[0].startsWith('http') ? match[0] : `https://${match[0]}`) : '';
}

function extractGitHub(text: string): string {
  const match = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+/i);
  return match ? (match[0].startsWith('http') ? match[0] : `https://${match[0]}`) : '';
}

function extractPortfolio(text: string): string {
  // Match URLs that are NOT linkedin or github
  const urlRegex = /https?:\/\/(?!(?:www\.)?(?:linkedin|github)\.com)[^\s,;)>\]"']+/gi;
  const matches = text.match(urlRegex);
  if (matches && matches.length > 0) {
    // Return the first non-linkedin, non-github URL
    return matches[0];
  }
  return '';
}

async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  try {
    const { extractText } = await import('unpdf');
    const result = await extractText(new Uint8Array(buffer), { mergePages: true });
    if (typeof result === 'string') return result;
    if (result && typeof result === 'object' && 'text' in result) return (result as any).text || '';
    if (result && typeof result === 'object' && 'totalPages' in result && 'text' in result) return (result as any).text || '';
    return String(result || '');
  } catch (err) {
    console.error('[unpdf extractText Error]:', err);
    return '';
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
    }

    // ── Step 1: Extract raw text from PDF/DOCX/TXT directly in Node.js ──
    let rawText = '';

    const arrayBuffer = await file.arrayBuffer();

    if (file.name.toLowerCase().endsWith('.pdf')) {
      rawText = await extractPdfText(arrayBuffer);
    } else {
      // TXT, MD, DOCX (as plain text fallback)
      const decoder = new TextDecoder('utf-8');
      rawText = decoder.decode(arrayBuffer);
    }

    const cleanText = rawText.replace(/\s+/g, ' ').trim();

    if (!cleanText || cleanText.length < 20) {
      return NextResponse.json({
        success: false,
        error: 'Could not extract text from the uploaded file. Please ensure the PDF is not scanned/image-only.',
      }, { status: 400 });
    }

    // ── Step 2: Regex-based field extraction (always works, no AI needed) ──
    const emailMatch = cleanText.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
    const phoneMatch = cleanText.match(/(\+?\d{1,3}[\s-]?\(?\d{2,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4})/);
    const expMatch = cleanText.match(/(\d+)\+?\s*(?:-\s*\d+)?\s*(?:years?|yrs?)/i);

    const minedSkills = mineSkills(cleanText);
    const fullName = extractFullName(rawText); // Use original text to preserve line breaks
    const email = emailMatch?.[1] || '';
    const phone = phoneMatch?.[1] || '';
    const linkedinUrl = extractLinkedIn(cleanText);
    const githubUrl = extractGitHub(cleanText);
    const portfolioUrl = extractPortfolio(cleanText);
    const yearsExperience = expMatch ? parseInt(expMatch[1], 10) : 0;
    const skills = minedSkills.join(', ');
    const resumeSummary = cleanText.slice(0, 600);
    const jobPreferences = minedSkills.length > 0
      ? `Roles focusing on ${minedSkills.slice(0, 8).join(', ')}.`
      : '';

    // Start with regex-based extraction results
    let parsedData = {
      fullName,
      email,
      phone,
      linkedinUrl,
      githubUrl,
      portfolioUrl,
      yearsExperience,
      skills,
      resumeSummary,
      jobPreferences,
    };

    // ── Step 3: Try FastAPI AI enhancement (optional, non-blocking) ──
    try {
      const fastApiFormData = new FormData();
      const blob = new Blob([arrayBuffer], { type: file.type });
      fastApiFormData.append('file', blob, file.name);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout for AI

      const res = await fetch(`${FASTAPI_BASE}/api/ai/parse-cv`, {
        method: 'POST',
        body: fastApiFormData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const aiData = await res.json();
        // AI results override regex results only if they're non-empty
        parsedData = {
          fullName: aiData.fullName || parsedData.fullName,
          email: aiData.email || parsedData.email,
          phone: aiData.phone || parsedData.phone,
          linkedinUrl: aiData.linkedinUrl || parsedData.linkedinUrl,
          githubUrl: aiData.githubUrl || parsedData.githubUrl,
          portfolioUrl: aiData.portfolioUrl || parsedData.portfolioUrl,
          yearsExperience: aiData.yearsExperience || parsedData.yearsExperience,
          skills: aiData.skills || parsedData.skills,
          resumeSummary: aiData.resumeSummary || parsedData.resumeSummary,
          jobPreferences: aiData.jobPreferences || parsedData.jobPreferences,
        };
      }
    } catch {
      console.log('[Parse CV] FastAPI AI enhancement unavailable — using regex-extracted fields.');
    }

    // ── Step 4: Persist to database ──
    let profile = await prisma.profile.findFirst();
    if (profile) {
      profile = await prisma.profile.update({
        where: { id: profile.id },
        data: {
          fullName: parsedData.fullName || profile.fullName,
          email: parsedData.email || profile.email,
          phone: parsedData.phone || profile.phone,
          linkedinUrl: parsedData.linkedinUrl || profile.linkedinUrl || '',
          githubUrl: parsedData.githubUrl || profile.githubUrl || '',
          portfolioUrl: parsedData.portfolioUrl || profile.portfolioUrl || '',
          yearsExperience: Number(parsedData.yearsExperience) || profile.yearsExperience,
          skills: parsedData.skills || profile.skills,
          resumeSummary: parsedData.resumeSummary || profile.resumeSummary,
          jobPreferences: parsedData.jobPreferences || profile.jobPreferences,
        },
      });
    } else {
      profile = await prisma.profile.create({
        data: {
          fullName: parsedData.fullName || '',
          email: parsedData.email || '',
          phone: parsedData.phone || '',
          linkedinUrl: parsedData.linkedinUrl || '',
          githubUrl: parsedData.githubUrl || '',
          portfolioUrl: parsedData.portfolioUrl || '',
          yearsExperience: Number(parsedData.yearsExperience) || 0,
          skills: parsedData.skills || '',
          resumeSummary: parsedData.resumeSummary || '',
          jobPreferences: parsedData.jobPreferences || '',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: parsedData,
      profile,
    });
  } catch (error: any) {
    console.error('[Parse CV Route Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
