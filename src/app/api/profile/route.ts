import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    let profile = await prisma.profile.findFirst();
    if (!profile) {
      profile = await prisma.profile.create({
        data: {
          fullName: 'Vandana Tech',
          email: 'vandana@example.com',
          phone: '+1 555-019-2831',
          linkedinUrl: 'https://linkedin.com/in/vandana-dev',
          githubUrl: 'https://github.com/vandana-dev',
          portfolioUrl: 'https://vandana.dev',
          yearsExperience: 4,
          skills: 'React, Next.js, TypeScript, Node.js, Python, LangChain, Playwright',
          jobPreferences: 'Remote Senior Full-Stack Software Engineer building Next.js, React, Node.js, AI apps & LLMs',
          resumeSummary: 'Full-stack software engineer with expertise in Next.js, React, Node.js, Python, Generative AI, LangChain, and browser automation.',
        },
      });
    }
    return NextResponse.json({ success: true, profile });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const data = await req.json();
    let profile = await prisma.profile.findFirst();
    
    if (profile) {
      profile = await prisma.profile.update({
        where: { id: profile.id },
        data: {
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          linkedinUrl: data.linkedinUrl,
          githubUrl: data.githubUrl,
          portfolioUrl: data.portfolioUrl,
          yearsExperience: Number(data.yearsExperience) || 0,
          skills: data.skills,
          jobPreferences: data.jobPreferences || '',
          resumeSummary: data.resumeSummary,
        },
      });
    } else {
      profile = await prisma.profile.create({
        data: {
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          linkedinUrl: data.linkedinUrl,
          githubUrl: data.githubUrl,
          portfolioUrl: data.portfolioUrl,
          yearsExperience: Number(data.yearsExperience) || 0,
          skills: data.skills,
          jobPreferences: data.jobPreferences || '',
          resumeSummary: data.resumeSummary,
        },
      });
    }

    return NextResponse.json({ success: true, profile });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
