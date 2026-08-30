'use client';

import { useState, useMemo } from 'react';
import { Briefcase, Sparkles, Send, CheckCircle, RefreshCw, MapPin, Building, ExternalLink, Search, Globe, ArrowUpDown, Code, Clock, DollarSign, ChevronDown, ChevronUp, FileText, Sliders, Bookmark } from 'lucide-react';
import { Job, Profile } from '@/types';

interface JobFeedProps {
  jobs: Job[];
  loading: boolean;
  scraping: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  handleScrape: (company?: string, location?: string) => void;
  handleScrapeCompany?: (companyName: string) => void;
  handleAutoApply: (jobId: string) => void;
  handleSaveJob?: (jobId: string) => void;
  handleOpenAtsModal?: (job: Job) => void;
  applyingId: string | null;
  appliedJobs: Record<string, string>;
  savedJobsMap?: Record<string, boolean>;
  profile?: Profile;
}

// Utility: strip HTML tags, entities, and navigation noise from description text
function stripHtmlForDisplay(raw: string): string {
  let text = raw;
  // Handle double-encoded entities first (&amp;lt; -> &lt; -> <)
  text = text.replace(/&amp;/g, '&');
  // Decode common HTML entities
  text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
  // Convert <br>, <li>, </p>, </div> to newlines for readability
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<li[^>]*>/gi, '\n• ');
  text = text.replace(/<\/(p|div|h[1-6]|tr|li|ul|ol)>/gi, '\n');
  // Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Remove navigation noise
  text = text.replace(/skip\s+to\s+(main\s+)?content/gi, '');
  // Clean non-breaking spaces
  text = text.replace(/\u00A0/g, ' ');
  // Collapse whitespace
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

export function JobFeed({
  jobs,
  loading,
  scraping,
  searchQuery,
  setSearchQuery,
  handleScrape,
  handleScrapeCompany,
  handleAutoApply,
  handleSaveJob,
  handleOpenAtsModal,
  applyingId,
  appliedJobs,
  savedJobsMap = {},
  profile,
}: JobFeedProps) {
  const [locationInput, setLocationInput] = useState<string>('');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'recent' | 'match' | 'preference'>('recent');
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [prefInput, setPrefInput] = useState<string>('');

  // Extract unique locations from loaded jobs for location dropdown
  const uniqueLocations = useMemo(() => {
    const locations = new Set<string>();
    jobs.forEach((job) => {
      if (job.location) {
        if (job.location.toLowerCase().includes('remote')) {
          locations.add('Remote');
        } else {
          locations.add(job.location);
        }
      }
    });
    return Array.from(locations).sort();
  }, [jobs]);

  // Compute preference match score dynamically using fuzzy keyword + semantic relevance weighting
  const jobsWithPrefScores = useMemo(() => {
    const prefQuery = prefInput.trim() || profile?.jobPreferences?.trim() || '';
    if (!prefQuery) return jobs.map((j) => ({ ...j, prefMatchScore: j.matchScore }));

    // Extract significant query terms (ignore common stop words)
    const stopWords = new Set(['role', 'roles', 'engineer', 'developer', 'level', 'looking', 'with', 'tech', 'stack', 'team', 'work', 'job']);
    const terms = prefQuery
      .toLowerCase()
      .split(/[\s,/;+]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2 && !stopWords.has(t));

    return jobs.map((job) => {
      const fullText = `${job.title} ${job.company} ${job.location} ${job.reqSkills || ''} ${job.cleanSummary || ''} ${job.description}`.toLowerCase();
      
      let termMatches = 0;
      let partialMatches = 0;

      terms.forEach((term) => {
        if (fullText.includes(term)) {
          termMatches += 1;
        } else {
          // Check partial substring / stemmed match
          const stem = term.slice(0, Math.max(3, term.length - 2));
          if (stem.length >= 3 && fullText.includes(stem)) {
            partialMatches += 0.5;
          }
        }
      });

      // Semantic domain affinity boost (e.g. AI / Frontend / Backend / Mobile / Data)
      let domainBoost = 0;
      if (/ai|ml|learning|data|model|python/i.test(prefQuery) && /data|ai|python|model|scientist|analyst|machine/i.test(fullText)) {
        domainBoost += 15;
      }
      if (/frontend|react|next|typescript|web|ui/i.test(prefQuery) && /frontend|react|next|web|typescript|javascript|ui/i.test(fullText)) {
        domainBoost += 15;
      }
      if (/backend|node|go|golang|c#|java|microservice/i.test(prefQuery) && /backend|node|go|golang|c#|net|java|microservice|sql/i.test(fullText)) {
        domainBoost += 15;
      }

      const totalTerms = terms.length || 1;
      const baseRatio = (termMatches + partialMatches) / totalTerms;
      const score = Math.min(Math.max(Math.round(baseRatio * 50 + domainBoost + 42), 45), 98);

      return { ...job, prefMatchScore: score };
    });
  }, [jobs, prefInput, profile?.jobPreferences]);

  // Filter and sort jobs
  const processedJobs = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    const locQ = (locationInput || '').trim().toLowerCase();
    
    let result = jobsWithPrefScores.filter((job) => {
      const titleMatch = (job.title || '').toLowerCase().includes(q);
      const companyMatch = (job.company || '').toLowerCase().includes(q);
      const locationMatch = (job.location || '').toLowerCase().includes(q);
      const skillsMatch = (job.reqSkills || '').toLowerCase().includes(q);
      const descMatch = (job.description || '').toLowerCase().includes(q);
      
      const matchesSearch = !q || titleMatch || companyMatch || locationMatch || skillsMatch || descMatch;
      
      const matchesTypedLocation = !locQ || (job.location || '').toLowerCase().includes(locQ);

      const matchesLocationDropdown =
        locationFilter === 'ALL' ||
        (locationFilter === 'Remote'
          ? (job.location || '').toLowerCase().includes('remote')
          : (job.location || '').toLowerCase().includes(locationFilter.toLowerCase()));

      return matchesSearch && matchesTypedLocation && matchesLocationDropdown;
    });

    // Sorting
    return result.sort((a, b) => {
      if (sortBy === 'recent') {
        return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
      } else if (sortBy === 'preference') {
        return (b.prefMatchScore || 0) - (a.prefMatchScore || 0);
      } else {
        return (b.matchScore || 0) - (a.matchScore || 0);
      }
    });
  }, [jobsWithPrefScores, searchQuery, locationInput, locationFilter, sortBy]);

  const toggleExpand = (jobId: string) => {
    setExpandedJobId(expandedJobId === jobId ? null : jobId);
  };

  const handleApplyPrefFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setSortBy('preference');
  };

  const triggerLiveFetch = () => {
    handleScrape(searchQuery.trim() || undefined, locationInput.trim() || undefined);
  };

  return (
    <section className="space-y-6">
      {/* Unified Search & AI Control Panel */}
      <div className="p-5 bg-zinc-950 border border-zinc-800 rounded-xl space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
          <label className="text-xs font-bold text-white flex items-center gap-2 uppercase tracking-wide font-mono">
            <Sliders className="w-4 h-4 text-amber-400" /> Unified AI Search & Matching Control
          </label>
          {profile?.jobPreferences && !prefInput && (
            <span className="text-[11px] text-zinc-500 font-mono">Profile Preferences Loaded</span>
          )}
        </div>

        {/* Row 1: Target Position Preferences */}
        <div className="space-y-1">
          <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
            Target Role & Tech Stack Preferences
          </span>
          <input
            type="text"
            placeholder="Type preferences (e.g. Remote Senior Engineer, $150k+, Go, Python, Machine Learning)..."
            value={prefInput}
            onChange={(e) => setPrefInput(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-black border border-zinc-800 rounded-md text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition font-mono"
          />
        </div>

        {/* Row 2: Search Query, Location & Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {/* Company / Role Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Company or Role (e.g. Ericsson, Figma)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-black border border-zinc-800 rounded-md text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition"
            />
          </div>

          {/* Location Input Box */}
          <div className="relative">
            <MapPin className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="City / Country (e.g. Noida, London, Remote)"
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-black border border-zinc-800 rounded-md text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition"
            />
          </div>

          {/* Location Dropdown */}
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-md text-xs text-zinc-300 focus:outline-none focus:border-zinc-500 transition"
          >
            <option value="ALL">All Locations</option>
            <option value="Remote">Remote Only</option>
            {uniqueLocations
              .filter((loc) => loc !== 'Remote')
              .map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
          </select>
        </div>

        {/* Row 3: Sort Selection + Combined Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-zinc-900">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-zinc-500">Sort Openings:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'recent' | 'match' | 'preference')}
              className="px-3 py-1.5 bg-black border border-zinc-800 rounded-md text-xs text-zinc-300 focus:outline-none focus:border-zinc-500 transition font-mono"
            >
              <option value="recent">Most Recent Openings</option>
              <option value="preference">Preference Match %</option>
              <option value="match">Highest ATS Match %</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter & Match Preference Button */}
            <button
              onClick={handleApplyPrefFilter}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-zinc-900 border border-zinc-700 text-zinc-200 hover:bg-zinc-800 text-xs font-medium rounded transition flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Match Preferences
            </button>

            {/* Direct Company Career Page Scraper Button */}
            {searchQuery && (
              <button
                onClick={() => (handleScrapeCompany ? handleScrapeCompany(searchQuery) : handleScrape(searchQuery))}
                disabled={scraping}
                className="flex-1 sm:flex-none px-3.5 py-2 bg-emerald-950/80 border border-emerald-700 text-emerald-300 hover:bg-emerald-900 text-xs font-medium rounded transition flex items-center justify-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
              >
                <Globe className={`w-3.5 h-3.5 text-emerald-400 ${scraping ? 'animate-spin' : ''}`} />
                {scraping ? 'Parsing Career Portal...' : `Parse "${searchQuery}" Career Page`}
              </button>
            )}

            {/* Combined Live Fetch Button */}
            <button
              onClick={triggerLiveFetch}
              disabled={scraping}
              className="flex-1 sm:flex-none px-4 py-2 bg-white text-black hover:bg-zinc-200 font-semibold text-xs rounded transition flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scraping ? 'animate-spin' : ''}`} />
              {scraping
                ? 'Scraping Openings...'
                : `Fetch Live ${searchQuery || 'Jobs'} ${locationInput ? `in ${locationInput}` : ''}`}
            </button>
          </div>
        </div>
      </div>

      {/* Feed Status Summary */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
        <h2 className="text-xs font-semibold tracking-wide text-zinc-400 uppercase flex items-center gap-2">
          <Briefcase className="w-3.5 h-3.5 text-zinc-500" /> Showing {processedJobs.length} of {jobs.length} Openings
        </h2>

        <div className="text-[11px] text-zinc-500 flex items-center gap-1 font-mono">
          <ArrowUpDown className="w-3 h-3" /> Sorted by: {sortBy === 'recent' ? 'Most Recent' : sortBy === 'preference' ? 'Preference Match %' : 'ATS Match Score'}
        </div>
      </div>

      {/* Feed List */}
      {loading ? (
        <div className="text-center py-16 text-zinc-500 text-xs font-mono">Loading job opportunities...</div>
      ) : processedJobs.length === 0 ? (
        <div className="text-center py-16 border border-zinc-800 rounded-lg space-y-3 p-6">
          <Globe className="w-8 h-8 text-zinc-600 mx-auto" />
          <p className="text-zinc-300 text-sm font-medium">
            {searchQuery || locationInput
              ? `No local openings found for "${[searchQuery, locationInput].filter(Boolean).join(' in ')}".`
              : 'No job openings loaded yet.'}
          </p>
          <p className="text-zinc-500 text-xs max-w-md mx-auto">
            Click below to scrape live openings for this location directly from career portals!
          </p>
          <button
            onClick={triggerLiveFetch}
            disabled={scraping}
            className="mt-2 px-4 py-2 bg-white text-black text-xs font-medium rounded hover:bg-zinc-200 transition disabled:opacity-50"
          >
            {scraping ? 'Scraping Live Jobs...' : `Fetch Live Openings ${locationInput ? `in ${locationInput}` : ''}`}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {processedJobs.map((job) => {
            const isApplying = applyingId === job.id;
            const status = appliedJobs[job.id];
            const isExpanded = expandedJobId === job.id;

            const skillsList = job.reqSkills
              ? job.reqSkills.split(',').map((s) => s.trim()).filter(Boolean)
              : [job.title];

            return (
              <div
                key={job.id}
                className="p-6 bg-zinc-950 border border-zinc-800 rounded-lg hover:border-zinc-700 transition flex flex-col justify-between space-y-5"
              >
                {/* Header Row */}
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 font-mono">
                          {job.platform}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {new Date(job.postedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-white tracking-tight">
                        {job.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400 pt-1">
                        <span className="flex items-center gap-1 font-semibold text-zinc-200">
                          <Building className="w-3.5 h-3.5 text-zinc-500" /> {job.company}
                        </span>
                        <span className="flex items-center gap-1 font-medium text-emerald-400">
                          <MapPin className="w-3.5 h-3.5 text-emerald-500" /> {job.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-zinc-500" /> {job.minExp || '3+ Years Exp'}
                        </span>
                        <span className="flex items-center gap-1 text-emerald-400 font-mono">
                          <DollarSign className="w-3.5 h-3.5 text-emerald-500" /> {job.salaryRange || 'Competitive Salary'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {job.prefMatchScore !== undefined && (
                        <div className="text-xs font-mono font-medium px-3 py-1 rounded-md bg-zinc-900 border border-zinc-700 text-amber-300 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          <span>{job.prefMatchScore}% Preference Match</span>
                        </div>
                      )}

                      {job.matchScore !== null && (
                        <div className="text-[11px] font-mono text-zinc-400">
                          {job.matchScore}% ATS Score
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AI Executive Summary */}
                  {job.cleanSummary && (
                    <div className="mt-4 p-3.5 bg-zinc-900/60 border border-zinc-800/80 rounded-md text-xs text-zinc-300 leading-relaxed">
                      <span className="font-semibold text-white flex items-center gap-1.5 mb-1 text-[11px] uppercase tracking-wider font-mono text-zinc-400">
                        <FileText className="w-3 h-3 text-amber-400" /> AI Executive Summary
                      </span>
                      <div className="whitespace-pre-line leading-relaxed">{job.cleanSummary}</div>
                    </div>
                  )}

                  {/* Extracted Required Skills */}
                  <div className="mt-4 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-mono text-zinc-500 mr-1 flex items-center gap-1">
                      <Code className="w-3 h-3 text-zinc-500" /> Key Skills:
                    </span>
                    {skillsList.map((skill, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>

                  {/* Collapsible Full Job Description */}
                  {isExpanded && (
                    <div className="mt-4 p-4 bg-black border border-zinc-900 rounded-md text-xs text-zinc-400 space-y-2 max-h-96 overflow-y-auto font-mono">
                      <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                        <h4 className="text-white font-semibold text-xs font-sans">Full Job Description:</h4>
                        {job.refinedDescription && (
                          <span className="text-[10px] text-amber-400 font-mono flex items-center gap-1 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/50">
                            <Sparkles className="w-3 h-3 text-amber-400" /> ChatModel Refined
                          </span>
                        )}
                      </div>
                      <div className="whitespace-pre-line leading-relaxed text-zinc-300">
                        {stripHtmlForDisplay(job.refinedDescription || job.description)}
                      </div>
                    </div>
                  )}
                </div>

                  {/* Footer Controls */}
                  <div className="border-t border-zinc-900 pt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition"
                      >
                        Source Opening <ExternalLink className="w-3 h-3" />
                      </a>

                      <button
                        onClick={() => toggleExpand(job.id)}
                        className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition font-mono"
                      >
                        {isExpanded ? (
                          <>
                            Hide Description <ChevronUp className="w-3 h-3" />
                          </>
                        ) : (
                          <>
                            Full Description <ChevronDown className="w-3 h-3" />
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* ATS Breakdown & Tailor Button */}
                      {handleOpenAtsModal && (
                        <button
                          onClick={() => handleOpenAtsModal(job)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-zinc-200 text-xs font-medium rounded transition"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" /> ATS Breakdown
                        </button>
                      )}

                      {/* Bookmark / Save Job Button */}
                      {handleSaveJob && (
                        <button
                          onClick={() => handleSaveJob(job.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs font-medium rounded transition ${
                            savedJobsMap[job.id]
                              ? 'bg-blue-950/60 border-blue-800 text-blue-300'
                              : 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-300'
                          }`}
                        >
                          <Bookmark className={`w-3.5 h-3.5 ${savedJobsMap[job.id] ? 'fill-blue-400 text-blue-400' : ''}`} />
                          {savedJobsMap[job.id] ? 'Saved' : 'Save Job'}
                        </button>
                      )}

                      {status ? (
                        <span className="text-xs font-mono text-white flex items-center gap-1.5 bg-zinc-900 px-2.5 py-1.5 rounded border border-zinc-700">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> {status}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAutoApply(job.id)}
                          disabled={isApplying}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white text-black hover:bg-zinc-200 text-xs font-medium rounded transition disabled:opacity-50"
                        >
                          {isApplying ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" /> Applying...
                            </>
                          ) : (
                            <>
                              <Send className="w-3 h-3" /> Auto Apply
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
