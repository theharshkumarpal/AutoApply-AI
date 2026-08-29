import { NextResponse } from 'next/server';

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
      const data = await res.json();
      return NextResponse.json({
        success: true,
        data,
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
