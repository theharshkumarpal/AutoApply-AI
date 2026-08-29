'use client';

import { RefreshCw } from 'lucide-react';
import { ApplicationLog } from '@/types';

interface ApplicationLogsProps {
  logs: ApplicationLog[];
  loadingLogs: boolean;
  fetchLogs: () => void;
}

export function ApplicationLogs({ logs, loadingLogs, fetchLogs }: ApplicationLogsProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Bot Application Execution History</h2>
          <p className="text-xs text-zinc-400 mt-1">Audit log of auto-apply submissions executed by Playwright.</p>
        </div>
        <button
          onClick={fetchLogs}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:text-white rounded transition"
        >
          <RefreshCw className={`w-3 h-3 ${loadingLogs ? 'animate-spin' : ''}`} /> Refresh Logs
        </button>
      </div>

      {loadingLogs ? (
        <div className="text-center py-16 text-zinc-500 text-xs font-mono">Loading history...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 border border-zinc-800 rounded-lg text-zinc-400 text-sm">
          No applications submitted yet. Trigger "Auto Apply" on any job in the Jobs feed!
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((item) => (
            <div key={item.id} className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-white">{item.job.title}</span>
                  <span className="text-xs text-zinc-400 ml-2">@ {item.job.company}</span>
                </div>
                <span
                  className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded border ${
                    item.status === 'SUBMITTED'
                      ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300'
                      : 'bg-red-950/50 border-red-800 text-red-300'
                  }`}
                >
                  {item.status}
                </span>
              </div>

              <p className="text-xs font-mono text-zinc-400 bg-black p-2 rounded border border-zinc-900">
                {item.logs || 'No log details available.'}
              </p>

              <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1">
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
