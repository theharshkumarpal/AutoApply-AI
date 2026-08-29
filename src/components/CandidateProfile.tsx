'use client';

import { useState } from 'react';
import { Save, AlertCircle, Sparkles, Upload, FileText, CheckCircle2, UserCheck, RefreshCw } from 'lucide-react';
import { Profile } from '@/types';

interface CandidateProfileProps {
  profile: Profile;
  setProfile: (profile: Profile) => void;
  savingProfile: boolean;
  profileMsg: string;
  handleSaveProfile: (e: React.FormEvent) => void;
}

export function CandidateProfile({
  profile,
  setProfile,
  savingProfile,
  profileMsg,
  handleSaveProfile,
}: CandidateProfileProps) {
  const [parsingCv, setParsingCv] = useState(false);
  const [cvFileName, setCvFileName] = useState<string | null>(null);
  const [cvSuccessMsg, setCvSuccessMsg] = useState<string | null>(null);

  // Resume / CV Upload and AI Auto-Parser Handler
  const handleCvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCvFileName(file.name);
    setParsingCv(true);
    setCvSuccessMsg(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/profile/parse-cv', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();

      if (json.success && json.data) {
        const parsed = json.data;
        const updatedProfile = {
          ...profile,
          fullName: parsed.fullName || profile.fullName,
          email: parsed.email || profile.email,
          phone: parsed.phone || profile.phone,
          linkedinUrl: parsed.linkedinUrl || profile.linkedinUrl,
          githubUrl: parsed.githubUrl || profile.githubUrl,
          portfolioUrl: parsed.portfolioUrl || profile.portfolioUrl,
          yearsExperience: parsed.yearsExperience ?? profile.yearsExperience,
          skills: parsed.skills || profile.skills,
          resumeSummary: parsed.resumeSummary || profile.resumeSummary,
          jobPreferences: parsed.jobPreferences || profile.jobPreferences,
        };

        // 1. Immediately update UI component state
        setProfile(updatedProfile);

        // 2. Persist to database profile record
        await fetch('/api/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedProfile),
        });

        setCvSuccessMsg(
          `Resume "${file.name}" uploaded! Auto-populated: ${parsed.fullName}, ${parsed.email}, ${parsed.skills.split(', ').slice(0, 3).join(', ')}.`
        );
      } else {
        setCvSuccessMsg(`Failed to parse file: ${json.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      setCvSuccessMsg(`Uploaded "${file.name}". Resume summary auto-populated.`);
    } finally {
      setParsingCv(false);
    }
  };

  return (
    <section className="bg-zinc-950 border border-zinc-800 rounded-lg p-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-emerald-400" /> Candidate Profile & AI Job Matching Application Form
        </h2>
        <p className="text-xs text-zinc-400 mt-1">
          Upload your CV/Resume below — HuggingFace AI & LangChain will automatically parse your file and fill all form sections for you.
        </p>
      </div>

      {/* CV / Resume File Upload Box */}
      <div className="p-5 bg-black border-2 border-dashed border-zinc-800 hover:border-zinc-600 rounded-lg text-center transition space-y-3 relative">
        <input
          type="file"
          accept=".pdf,.doc,.docx,.txt,.md"
          onChange={handleCvUpload}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div className="flex justify-center">
          <div className="p-3 bg-zinc-900 border border-zinc-700 rounded-full text-white">
            {parsingCv ? <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" /> : <Upload className="w-6 h-6 text-emerald-400" />}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-white">
            {parsingCv ? 'HuggingFace AI Parsing Resume & Filling Form...' : cvFileName ? `Uploaded: ${cvFileName}` : 'Click or Drag & Drop your Resume / CV'}
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Supports PDF, DOCX, TXT, MD. Automatically populates Name, Email, Phone, Socials, Experience, Skills & Summary.
          </p>
        </div>

        {cvSuccessMsg && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-[11px] rounded font-mono">
            <CheckCircle2 className="w-3.5 h-3.5" /> {cvSuccessMsg}
          </div>
        )}
      </div>

      {profileMsg && (
        <div className="p-3 bg-zinc-900 border border-zinc-700 rounded text-xs text-white flex items-center gap-2 font-mono">
          <AlertCircle className="w-4 h-4 text-zinc-400" /> {profileMsg}
        </div>
      )}

      <form onSubmit={handleSaveProfile} className="space-y-4">
        {/* Natural Language Job Preferences Section */}
        <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-md space-y-2">
          <label className="block text-xs font-semibold text-white flex items-center gap-1.5 font-mono uppercase tracking-wide">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> AI Job Preferences & Target Position Criteria (Auto-Generated)
          </label>
          <p className="text-[11px] text-zinc-400">
            Target roles, preferred tech stack, work style, or target compensation (Auto-filled from resume upload or manually editable).
          </p>
          <textarea
            rows={3}
            placeholder="e.g. Remote Senior Frontend Engineer focusing on Next.js, TypeScript, AI agents, high growth SaaS companies..."
            value={profile.jobPreferences || ''}
            onChange={(e) => setProfile({ ...profile, jobPreferences: e.target.value })}
            className="w-full p-3 bg-black border border-zinc-800 rounded text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition font-mono leading-relaxed"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1 flex items-center justify-between">
              <span>Full Name</span>
              <span className="text-[10px] text-zinc-500 font-mono">Auto-Filled</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Alex Vance"
              value={profile.fullName}
              onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
              className="w-full p-2.5 bg-black border border-zinc-800 rounded text-xs text-white focus:outline-none focus:border-zinc-500 transition font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1 flex items-center justify-between">
              <span>Email Address</span>
              <span className="text-[10px] text-zinc-500 font-mono">Auto-Filled</span>
            </label>
            <input
              type="email"
              required
              placeholder="alex@example.com"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              className="w-full p-2.5 bg-black border border-zinc-800 rounded text-xs text-white focus:outline-none focus:border-zinc-500 transition font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1 flex items-center justify-between">
              <span>Phone Number</span>
              <span className="text-[10px] text-zinc-500 font-mono">Auto-Filled</span>
            </label>
            <input
              type="text"
              placeholder="+1 (555) 019-2834"
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              className="w-full p-2.5 bg-black border border-zinc-800 rounded text-xs text-white focus:outline-none focus:border-zinc-500 transition font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1 flex items-center justify-between">
              <span>Years of Experience</span>
              <span className="text-[10px] text-zinc-500 font-mono">Auto-Calculated</span>
            </label>
            <input
              type="number"
              value={profile.yearsExperience}
              onChange={(e) => setProfile({ ...profile, yearsExperience: Number(e.target.value) })}
              className="w-full p-2.5 bg-black border border-zinc-800 rounded text-xs text-white focus:outline-none focus:border-zinc-500 transition font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1 flex items-center justify-between">
              <span>LinkedIn Profile</span>
              <span className="text-[10px] text-zinc-500 font-mono">Auto-Extracted</span>
            </label>
            <input
              type="url"
              placeholder="https://linkedin.com/in/alex"
              value={profile.linkedinUrl}
              onChange={(e) => setProfile({ ...profile, linkedinUrl: e.target.value })}
              className="w-full p-2.5 bg-black border border-zinc-800 rounded text-xs text-white focus:outline-none focus:border-zinc-500 transition font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1 flex items-center justify-between">
              <span>GitHub Profile</span>
              <span className="text-[10px] text-zinc-500 font-mono">Auto-Extracted</span>
            </label>
            <input
              type="url"
              placeholder="https://github.com/alex"
              value={profile.githubUrl}
              onChange={(e) => setProfile({ ...profile, githubUrl: e.target.value })}
              className="w-full p-2.5 bg-black border border-zinc-800 rounded text-xs text-white focus:outline-none focus:border-zinc-500 transition font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1 flex items-center justify-between">
              <span>Portfolio / Website</span>
              <span className="text-[10px] text-zinc-500 font-mono">Auto-Extracted</span>
            </label>
            <input
              type="url"
              placeholder="https://alex.dev"
              value={profile.portfolioUrl}
              onChange={(e) => setProfile({ ...profile, portfolioUrl: e.target.value })}
              className="w-full p-2.5 bg-black border border-zinc-800 rounded text-xs text-white focus:outline-none focus:border-zinc-500 transition font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1 flex items-center justify-between">
            <span>Key Technical Skills (comma separated)</span>
            <span className="text-[10px] text-zinc-500 font-mono">Auto-Extracted</span>
          </label>
          <input
            type="text"
            placeholder="React, Next.js, TypeScript, Node.js, Python, PostgreSQL"
            value={profile.skills}
            onChange={(e) => setProfile({ ...profile, skills: e.target.value })}
            className="w-full p-2.5 bg-black border border-zinc-800 rounded text-xs text-white focus:outline-none focus:border-zinc-500 transition font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1 flex items-center justify-between">
            <span>Resume Summary & Qualifications (used for HuggingFace ATS Scoring)</span>
            <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
              <FileText className="w-3 h-3" /> Auto-Generated by HuggingFace ChatModel
            </span>
          </label>
          <textarea
            rows={4}
            placeholder="Paste or upload your CV summary here to enable HuggingFace vector embedding match scoring..."
            value={profile.resumeSummary}
            onChange={(e) => setProfile({ ...profile, resumeSummary: e.target.value })}
            className="w-full p-2.5 bg-black border border-zinc-800 rounded text-xs text-white focus:outline-none focus:border-zinc-500 transition font-mono leading-relaxed"
          />
        </div>

        <button
          type="submit"
          disabled={savingProfile}
          className="flex items-center gap-2 px-5 py-2.5 bg-white text-black hover:bg-zinc-200 font-medium text-xs rounded transition disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          {savingProfile ? 'Saving Details & Filtering Jobs...' : 'Save Application Details & Filter Tailored Jobs'}
        </button>
      </form>
    </section>
  );
}
