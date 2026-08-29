'use client';

import { useState, useEffect } from 'react';
import { Briefcase, Bot, User, History } from 'lucide-react';
import { Job, Profile, ApplicationLog } from '@/types';
import { JobFeed } from '@/components/JobFeed';
import { CandidateProfile } from '@/components/CandidateProfile';
import { ApplicationLogs } from '@/components/ApplicationLogs';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'feed' | 'profile' | 'logs'>('feed');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [appliedJobs, setAppliedJobs] = useState<Record<string, string>>({});

  // Filtering state
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('ALL');

  // Profile state
  const [profile, setProfile] = useState<Profile>({
    fullName: '',
    email: '',
    phone: '',
    linkedinUrl: '',
    githubUrl: '',
    portfolioUrl: '',
    yearsExperience: 0,
    skills: '',
    resumeSummary: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  // Logs state
  const [logs, setLogs] = useState<ApplicationLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/jobs');
      const data = await res.json();
      if (data.success) {
        setJobs(data.jobs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile');
      const data = await res.json();
      if (data.success && data.profile) {
        setProfile(data.profile);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/applications');
      const data = await res.json();
      if (data.success) {
        setLogs(data.applications);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg('');
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (data.success) {
        setProfileMsg('Profile saved successfully!');
      } else {
        setProfileMsg(`Failed to save: ${data.error}`);
      }
    } catch (err: any) {
      setProfileMsg(`Error: ${err.message}`);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleScrape = async (company?: string, location?: string) => {
    setScraping(true);
    try {
      await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company, location, platform: platformFilter }),
      });
      await fetchJobs();
    } catch (err) {
      console.error(err);
    } finally {
      setScraping(false);
    }
  };

  const handleAutoApply = async (jobId: string) => {
    setApplyingId(jobId);
    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (data.success) {
        setAppliedJobs((prev) => ({ ...prev, [jobId]: 'Submitted via Bot' }));
      } else {
        setAppliedJobs((prev) => ({ ...prev, [jobId]: `Failed: ${data.error || 'Check logs'}` }));
      }
      fetchLogs();
    } catch (err: any) {
      setAppliedJobs((prev) => ({ ...prev, [jobId]: `Error: ${err.message}` }));
    } finally {
      setApplyingId(null);
    }
  };

  useEffect(() => {
    fetchJobs();
    fetchProfile();
    fetchLogs();
  }, []);

  return (
    <main className="min-h-screen bg-black text-white p-6 md:p-12 font-sans antialiased">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Minimalist Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-zinc-900 border border-zinc-700 rounded-md text-white">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">JobApplier</h1>
              <p className="text-xs text-zinc-400 mt-0.5">Minimalist Career Scraper & Auto-Apply Bot</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('feed')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === 'feed' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" /> Jobs
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === 'profile' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" /> Resume / Profile
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === 'logs' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" /> Apply Logs
            </button>
          </div>
        </header>

        {/* Render Tab Views */}
        {activeTab === 'feed' && (
          <JobFeed
            jobs={jobs}
            loading={loading}
            scraping={scraping}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            platformFilter={platformFilter}
            setPlatformFilter={setPlatformFilter}
            handleScrape={handleScrape}
            handleAutoApply={handleAutoApply}
            applyingId={applyingId}
            appliedJobs={appliedJobs}
            profile={profile}
          />
        )}

        {activeTab === 'profile' && (
          <CandidateProfile
            profile={profile}
            setProfile={setProfile}
            savingProfile={savingProfile}
            profileMsg={profileMsg}
            handleSaveProfile={handleSaveProfile}
          />
        )}

        {activeTab === 'logs' && (
          <ApplicationLogs logs={logs} loadingLogs={loadingLogs} fetchLogs={fetchLogs} />
        )}
      </div>
    </main>
  );
}
