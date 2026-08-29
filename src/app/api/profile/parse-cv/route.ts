import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const FASTAPI_BASE = process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
    }

    // Proxy PDF file payload directly to Python FastAPI microservice
    const fastApiFormData = new FormData();
    fastApiFormData.append('file', file, file.name);

    const res = await fetch(`${FASTAPI_BASE}/api/ai/parse-cv`, {
      method: 'POST',
      body: fastApiFormData,
    });

    if (res.ok) {
      const parsedData = await res.json();
      
      // Save/Upsert parsed profile into Supabase PostgreSQL via Prisma
      let profile = await prisma.profile.findFirst();
      if (profile) {
        profile = await prisma.profile.update({
          where: { id: profile.id },
          data: {
            fullName: parsedData.fullName || profile.fullName,
            email: parsedData.email || profile.email,
            phone: parsedData.phone || profile.phone,
            yearsExperience: Number(parsedData.yearsExperience) || profile.yearsExperience,
            skills: parsedData.skills || profile.skills,
            resumeSummary: parsedData.resumeSummary || profile.resumeSummary,
            jobPreferences: parsedData.jobPreferences || profile.jobPreferences,
          },
        });
      } else {
        profile = await prisma.profile.create({
          data: {
            fullName: parsedData.fullName || 'Candidate',
            email: parsedData.email || '',
            phone: parsedData.phone || '',
            linkedinUrl: parsedData.linkedinUrl || '',
            githubUrl: parsedData.githubUrl || '',
            portfolioUrl: parsedData.portfolioUrl || '',
            yearsExperience: Number(parsedData.yearsExperience) || 3,
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
    }

    const errText = await res.text();
    console.error('[FastAPI Parse CV Failure]:', errText);

    return NextResponse.json({ success: false, error: 'FastAPI service error' }, { status: 500 });
  } catch (error: any) {
    console.error('[Parse CV Route Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
