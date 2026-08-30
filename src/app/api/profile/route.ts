import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const profile = await prisma.profile.findFirst();
    return NextResponse.json({ success: true, profile });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const data = await req.json();
    let profile = await prisma.profile.findFirst();
    
    const profileData = {
      fullName: data.fullName || '',
      email: data.email || '',
      phone: data.phone || '',
      linkedinUrl: data.linkedinUrl || '',
      githubUrl: data.githubUrl || '',
      portfolioUrl: data.portfolioUrl || '',
      yearsExperience: Number(data.yearsExperience) || 0,
      skills: data.skills || '',
      jobPreferences: data.jobPreferences || '',
      resumeSummary: data.resumeSummary || '',
    };

    if (profile) {
      profile = await prisma.profile.update({
        where: { id: profile.id },
        data: profileData,
      });
    } else {
      profile = await prisma.profile.create({
        data: profileData,
      });
    }

    return NextResponse.json({ success: true, profile });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
