'use client';

import { useState } from 'react';
import { RefreshCw, LayoutGrid, List, Bookmark, Send, CalendarCheck, Trophy, XCircle, MapPin, Building, ExternalLink, ArrowRight } from 'lucide-react';
import { ApplicationLog } from '@/types';

interface ApplicationLogsProps {
  logs: ApplicationLog[];
  loadingLogs: boolean;
  fetchLogs: () => void;
  onUpdateStatus?: (applicationId: string, status: string) => void;
}

export function ApplicationLogs({ logs, loadingLogs, fetchLogs, onUpdateStatus }: ApplicationLogsProps) {
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Compute analytics
  const totalApps = logs.length;
  const savedCount = logs.filter((l) => l.status === 'SAVED').length;
  const submittedCount = logs.filter((l) => l.status === 'SUBMITTED' || l.status === 'APPLIED').length;
  const interviewingCount = logs.filter((l) => l.status === 'INTERVIEWING').length;
  const offerCount = logs.filter((l) => l.status === 'OFFER').length;
  const rejectedCount = logs.filter((l) => l.status === 'REJECTED' || l.status === 'FAILED').length;

  const interviewRate = totalApps > 0 ? Math.round(((interviewingCount + offerCount) / totalApps) * 100) : 0;

  const columns = [
    { key: 'SAVED', label: 'Saved', icon: Bookmark, color: 'text-blue-400', badge: 'bg-blue-950/40 border-blue-800 text-blue-300' },
    { key: 'SUBMITTED', label: 'Applied', icon: Send, color: 'text-emerald-400', badge: 'bg-emerald-950/40 border-emerald-800 text-emerald-300' },
    { key: 'INTERVIEWING', label: 'Interviewing', icon: CalendarCheck, color: 'text-amber-400', badge: 'bg-amber-950/40 border-amber-800 text-amber-300' },
    { key: 'OFFER', label: 'Offers', icon: Trophy, color: 'text-purple-400', badge: 'bg-purple-950/40 border-purple-800 text-purple-300' },
    { key: 'REJECTED', label: 'Archived / Failed', icon: XCircle, color: 'text-rose-400', badge: 'bg-rose-950/40 border-rose-800 text-rose-300' },
  ];

  const handleStatusChange = (appId: string, newStatus: string) => {
    if (onUpdateStatus) {
      onUpdateStatus(appId, newStatus);
    }
  };

  return (
    <section className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Job Application Pipeline & Analytics</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Manage application stages across your job search pipeline in real-time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded text-xs font-medium transition flex items-center gap-1 ${
                viewMode === 'kanban' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Kanban
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded text-xs font-medium transition flex items-center gap-1 ${
                viewMode === 'list' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" /> Audit List
            </button>
          </div>

          <button
            onClick={fetchLogs}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:text-white rounded-lg transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} /> Refresh Pipeline
          </button>
        </div>
      </div>

      {/* Analytics Dashboard Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
        <div className="space-y-1">
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Total Active</span>
          <p className="text-xl font-bold font-mono text-white">{totalApps}</p>
        </div>

        <div className="space-y-1">
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Applied</span>
          <p className="text-xl font-bold font-mono text-emerald-400">{submittedCount}</p>
        </div>

        <div className="space-y-1">
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Interviewing</span>
          <p className="text-xl font-bold font-mono text-amber-400">{interviewingCount}</p>
        </div>

        <div className="space-y-1">
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Offers Received</span>
          <p className="text-xl font-bold font-mono text-purple-400">{offerCount}</p>
        </div>

        <div className="space-y-1 col-span-2 sm:col-span-1">
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Interview Rate</span>
          <p className="text-xl font-bold font-mono text-emerald-400">{interviewRate}%</p>
        </div>
      </div>

      {loadingLogs ? (
        <div className="text-center py-16 text-zinc-500 text-xs font-mono">Loading pipeline applications...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 border border-zinc-800 rounded-lg text-zinc-400 text-sm space-y-2 p-6">
          <Bookmark className="w-8 h-8 text-zinc-600 mx-auto" />
          <p className="text-zinc-300 font-medium">No active applications in pipeline.</p>
          <p className="text-zinc-500 text-xs max-w-sm mx-auto">
            Bookmark opportunities using "Save Job" or trigger "Auto Apply" in the Jobs feed to populate your board!
          </p>
        </div>
      ) : viewMode === 'kanban' ? (
        /* Kanban Columns View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-start">
          {columns.map((col) => {
            const Icon = col.icon;
            const colLogs = logs.filter((l) => {
              if (col.key === 'SUBMITTED') return l.status === 'SUBMITTED' || l.status === 'APPLIED';
              if (col.key === 'REJECTED') return l.status === 'REJECTED' || l.status === 'FAILED';
              return l.status === col.key;
            });

            return (
              <div key={col.key} className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 space-y-3 min-h-[350px]">
                {/* Column Header */}
                <div className="flex items-center justify-between border-b border-zinc-900 pb-2.5">
                  <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-white uppercase tracking-wider">
                    <Icon className={`w-4 h-4 ${col.color}`} /> {col.label}
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 font-bold">
                    {colLogs.length}
                  </span>
                </div>

                {/* Cards Container */}
                <div className="space-y-3">
                  {colLogs.length === 0 ? (
                    <div className="py-8 text-center text-[11px] font-mono text-zinc-600 border border-dashed border-zinc-900 rounded-lg">
                      No jobs in {col.label}
                    </div>
                  ) : (
                    colLogs.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-black border border-zinc-800 hover:border-zinc-700 rounded-lg space-y-2.5 transition shadow"
                      >
                        <div>
                          <h4 className="text-xs font-bold text-white tracking-tight leading-snug">
                            {item.job.title}
                          </h4>
                          <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-1 font-mono">
                            <span className="flex items-center gap-1">
                              <Building className="w-3 h-3 text-zinc-500" /> {item.job.company}
                            </span>
                            <a
                              href={item.job.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-zinc-500 hover:text-white"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>

                        {item.job.location && (
                          <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-emerald-500" /> {item.job.location}
                          </div>
                        )}

                        {/* Interactive Stage Selector */}
                        <div className="pt-2 border-t border-zinc-900 flex items-center justify-between gap-1">
                          <span className="text-[9px] font-mono text-zinc-500 uppercase">Stage:</span>
                          <select
                            value={col.key === 'SUBMITTED' && item.status === 'APPLIED' ? 'SUBMITTED' : item.status}
                            onChange={(e) => handleStatusChange(item.id, e.target.value)}
                            className="text-[10px] font-mono px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded focus:outline-none focus:border-zinc-600 transition"
                          >
                            <option value="SAVED">Saved</option>
                            <option value="SUBMITTED">Applied</option>
                            <option value="INTERVIEWING">Interviewing</option>
                            <option value="OFFER">Offer</option>
                            <option value="REJECTED">Rejected</option>
                          </select>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List Audit Log View */
        <div className="space-y-3">
          {logs.map((item) => (
            <div key={item.id} className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-white">{item.job.title}</span>
                  <span className="text-xs text-zinc-400 ml-2">@ {item.job.company}</span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={item.status}
                    onChange={(e) => handleStatusChange(item.id, e.target.value)}
                    className="text-[10px] font-mono px-2 py-1 bg-zinc-900 border border-zinc-700 text-zinc-300 rounded"
                  >
                    <option value="SAVED">Saved</option>
                    <option value="SUBMITTED">Applied</option>
                    <option value="INTERVIEWING">Interviewing</option>
                    <option value="OFFER">Offer</option>
                    <option value="REJECTED">Rejected / Failed</option>
                  </select>
                </div>
              </div>

              <p className="text-xs font-mono text-zinc-400 bg-black p-2 rounded border border-zinc-900">
                {item.logs || 'No log details available.'}
              </p>

              <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1 font-mono">
                <span>Platform: {item.job.platform}</span>
                <span>{new Date(item.appliedAt).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
