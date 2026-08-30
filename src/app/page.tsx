'use client';

import { useState, useEffect } from 'react';
import { Briefcase, Bot, User, History, LayoutGrid } from 'lucide-react';
import { Job, Profile, ApplicationLog, AtsBreakdown } from '@/types';
import { JobFeed } from '@/components/JobFeed';
import { CandidateProfile } from '@/components/CandidateProfile';
import { ApplicationLogs } from '@/components/ApplicationLogs';
import { AtsBreakdownModal } from '@/components/AtsBreakdownModal';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'feed' | 'profile' | 'logs'>('feed');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [appliedJobs, setAppliedJobs] = useState<Record<string, string>>({});
  const [savedJobsMap, setSavedJobsMap] = useState<Record<string, boolean>>({});

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

  // Pipeline & Logs state
  const [logs, setLogs] = useState<ApplicationLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // ATS Modal State
  const [atsModalJob, setAtsModalJob] = useState<Job | null>(null);
  const [atsBreakdown, setAtsBreakdown] = useState<AtsBreakdown | null>(null);
  const [loadingAtsBreakdown, setLoadingAtsBreakdown] = useState(false);

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
        const map: Record<string, boolean> = {};
        data.applications.forEach((app: ApplicationLog) => {
          if (app.jobId) map[app.jobId] = true;
          if (app.job?.id) map[app.job.id] = true;
        });
        setSavedJobsMap(map);
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
        setProfileMsg('Profile saved successfully to database!');
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

  const handleSaveJob = async (jobId: string) => {
    try {
      const res = await fetch('/api/applications/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, status: 'SAVED' }),
      });
      const data = await res.json();
      if (data.success) {
        setSavedJobsMap((prev) => ({ ...prev, [jobId]: true }));
        fetchLogs();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (applicationId: string, status: string) => {
    try {
      const res = await fetch('/api/applications/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId, status }),
      });
      const data = await res.json();
      if (data.success) {
        fetchLogs();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenAtsModal = async (job: Job) => {
    setAtsModalJob(job);
    setAtsBreakdown(null);
    setLoadingAtsBreakdown(true);
    try {
      const res = await fetch('/api/jobs/ats-breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id }),
      });
      const data = await res.json();
      if (data.success) {
        setAtsBreakdown(data.breakdown);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAtsBreakdown(false);
    }
  };

  const handleApplyTailoredSummary = async (tailoredSummary: string) => {
    const updatedSummary = profile.resumeSummary ? `${profile.resumeSummary}\n\n• ${tailoredSummary}` : `• ${tailoredSummary}`;
    const updated = { ...profile, resumeSummary: updatedSummary };
    setProfile(updated);

    try {
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchJobs();
    fetchProfile();
    fetchLogs();
  }, []);

  return (
    <main className="min-h-screen bg-black text-white p-4 sm:p-6 md:p-12 font-sans antialiased">
      <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
        {/* Minimalist Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5 sm:pb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-zinc-900 border border-zinc-700 rounded-md text-white shrink-0">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">JobApplier AI</h1>
              <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5">Career Board Scraper, Kanban Pipeline Tracker & ATS Optimizer</p>
            </div>
          </div>

          {/* Navigation Tabs - Horizontally Scrollable on Mobile */}
          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 p-1 rounded-lg overflow-x-auto max-w-full">
            <button
              onClick={() => setActiveTab('feed')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition ${
                activeTab === 'feed' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" /> Jobs Feed
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition ${
                activeTab === 'profile' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" /> Resume / Profile
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition ${
                activeTab === 'logs' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Application Pipeline ({logs.length})
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
            handleSaveJob={handleSaveJob}
            handleOpenAtsModal={handleOpenAtsModal}
            applyingId={applyingId}
            appliedJobs={appliedJobs}
            savedJobsMap={savedJobsMap}
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
          <ApplicationLogs
            logs={logs}
            loadingLogs={loadingLogs}
            fetchLogs={fetchLogs}
            onUpdateStatus={handleUpdateStatus}
          />
        )}

        {/* ATS Breakdown Modal */}
        {atsModalJob && (
          <AtsBreakdownModal
            job={atsModalJob}
            profile={profile}
            breakdown={atsBreakdown}
            loading={loadingAtsBreakdown}
            onClose={() => setAtsModalJob(null)}
            onApplyTailoredSummary={handleApplyTailoredSummary}
          />
        )}
      </div>
    </main>
  );
}
