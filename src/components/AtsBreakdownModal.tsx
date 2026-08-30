'use client';

import { useState } from 'react';
import { X, CheckCircle, AlertTriangle, Lightbulb, Sparkles, Copy, Check, ArrowRight } from 'lucide-react';
import { Job, Profile, AtsBreakdown } from '@/types';

interface AtsBreakdownModalProps {
  job: Job;
  profile?: Profile;
  breakdown: AtsBreakdown | null;
  loading: boolean;
  onClose: () => void;
  onApplyTailoredSummary?: (summary: string) => void;
}

export function AtsBreakdownModal({
  job,
  breakdown,
  loading,
  onClose,
  onApplyTailoredSummary,
}: AtsBreakdownModalProps) {
  const [copied, setCopied] = useState(false);
  const [appliedToProfile, setAppliedToProfile] = useState(false);

  if (!job) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyToProfile = (text: string) => {
    if (onApplyTailoredSummary) {
      onApplyTailoredSummary(text);
      setAppliedToProfile(true);
      setTimeout(() => setAppliedToProfile(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl w-full max-w-2xl p-4 sm:p-6 space-y-5 sm:space-y-6 shadow-2xl relative my-auto max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-800 pb-3 sm:pb-4 gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-amber-400">
                ATS Analysis & AI Tailor
              </span>
              <span className="text-xs text-zinc-500 font-mono truncate max-w-[200px]">{job.company}</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight mt-1">{job.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white rounded-md hover:bg-zinc-900 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-zinc-500 text-xs font-mono flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 animate-spin shrink-0" /> Analyzing resume keywords & generating ATS breakdown...
          </div>
        ) : breakdown ? (
          <div className="space-y-5 sm:space-y-6">
            {/* Score Banner */}
            <div className="p-3.5 sm:p-4 bg-zinc-900/80 border border-zinc-800 rounded-lg flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Estimated ATS Match</span>
                <p className="text-[11px] sm:text-xs text-zinc-500 mt-0.5">Based on technical skill overlap and job terms</p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">{breakdown.matchScore}%</span>
                <span className="block text-[10px] text-zinc-500 font-mono">Compatibility Score</span>
              </div>
            </div>

            {/* Matched vs Missing Skills Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Matched Skills */}
              <div className="p-3.5 sm:p-4 bg-emerald-950/20 border border-emerald-900/50 rounded-lg space-y-2">
                <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 font-mono uppercase tracking-wide">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" /> Matched Skills ({breakdown.matchedSkills.length})
                </h4>
                {breakdown.matchedSkills.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic font-mono">No direct skill overlap detected.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {breakdown.matchedSkills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-900/40 border border-emerald-700/60 text-emerald-200"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Missing Skills */}
              <div className="p-3.5 sm:p-4 bg-amber-950/20 border border-amber-900/50 rounded-lg space-y-2">
                <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5 font-mono uppercase tracking-wide">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" /> Missing Key Terms ({breakdown.missingSkills.length})
                </h4>
                {breakdown.missingSkills.length === 0 ? (
                  <p className="text-xs text-emerald-400 font-mono">Great job! All required skills matched.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {breakdown.missingSkills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-900/40 border border-amber-700/60 text-amber-200"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recommendations */}
            <div className="p-3.5 sm:p-4 bg-zinc-900/60 border border-zinc-800 rounded-lg space-y-2">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5 font-mono uppercase tracking-wide">
                <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" /> Actionable Recommendations to Boost Score
              </h4>
              <ul className="space-y-1.5 pt-1">
                {breakdown.recommendations.map((rec, idx) => (
                  <li key={idx} className="text-xs text-zinc-300 flex items-start gap-2 leading-relaxed">
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* AI Tailored Resume Bullet Generator */}
            <div className="p-3.5 sm:p-4 bg-zinc-900 border border-zinc-800 rounded-lg space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5 font-mono uppercase tracking-wide">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" /> Tailored AI Resume Bullet
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(breakdown.tailoredSummary)}
                    className="flex-1 sm:flex-none justify-center px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] rounded font-mono flex items-center gap-1 transition"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400 shrink-0" /> : <Copy className="w-3 h-3 shrink-0" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    onClick={() => handleApplyToProfile(breakdown.tailoredSummary)}
                    className="flex-1 sm:flex-none justify-center px-2.5 py-1 bg-white hover:bg-zinc-200 text-black font-semibold text-[11px] rounded transition flex items-center gap-1"
                  >
                    {appliedToProfile ? <Check className="w-3 h-3 text-emerald-600 shrink-0" /> : <Sparkles className="w-3 h-3 shrink-0" />}
                    {appliedToProfile ? 'Applied!' : 'Add to Profile'}
                  </button>
                </div>
              </div>
              <p className="text-xs text-zinc-300 font-mono bg-black p-3 rounded border border-zinc-800 leading-relaxed">
                {breakdown.tailoredSummary}
              </p>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-zinc-500 text-xs font-mono">Failed to load ATS breakdown.</div>
        )}
      </div>
    </div>
  );
}
