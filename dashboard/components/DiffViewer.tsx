'use client';

import React from 'react';
import { GitCompare, FileCode, Check, Copy } from 'lucide-react';

interface DiffViewerProps {
  diff: string;
  culpritFile?: string;
  testPassed?: boolean;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  diff,
  culpritFile = 'Identified Component',
  testPassed = false
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(diff);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = diff ? diff.split('\n') : [];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col h-full">
      {/* Diff Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950/90 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <FileCode className="w-4 h-4 text-cyan-400" />
          <span className="font-mono text-xs font-bold text-slate-200">
            {culpritFile}
          </span>
          <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
            Unified Git Patch
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {testPassed && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Verified in Sandbox
            </span>
          )}
          <button
            onClick={handleCopy}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded transition-colors text-xs flex items-center gap-1"
            title="Copy diff to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Diff Code Body */}
      <div className="p-4 font-mono text-xs overflow-x-auto overflow-y-auto max-h-[380px] bg-slate-950/60 leading-relaxed">
        {lines.length > 0 ? (
          lines.map((line, index) => {
            let lineStyle = 'text-slate-400';
            let bgStyle = 'hover:bg-slate-900/40';

            if (line.startsWith('+') && !line.startsWith('+++')) {
              lineStyle = 'text-emerald-300 font-medium';
              bgStyle = 'bg-emerald-950/40 border-l-2 border-emerald-500';
            } else if (line.startsWith('-') && !line.startsWith('---')) {
              lineStyle = 'text-rose-300 font-medium line-through opacity-85';
              bgStyle = 'bg-rose-950/40 border-l-2 border-rose-500';
            } else if (line.startsWith('@@')) {
              lineStyle = 'text-cyan-400 font-semibold italic';
              bgStyle = 'bg-cyan-950/30';
            } else if (line.startsWith('---') || line.startsWith('+++')) {
              lineStyle = 'text-indigo-300 font-bold';
              bgStyle = 'bg-indigo-950/30';
            }

            return (
              <div
                key={index}
                className={`flex py-0.5 px-2 rounded-sm ${bgStyle} transition-colors font-mono whitespace-pre`}
              >
                <span className="w-8 select-none text-right pr-3 text-slate-600 font-mono text-[11px]">
                  {index + 1}
                </span>
                <span className={lineStyle}>{line}</span>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 space-y-2">
            <GitCompare className="w-8 h-8 opacity-40" />
            <p className="text-xs">No active patch generated. Trigger an incident to begin.</p>
          </div>
        )}
      </div>

      {/* Bottom Summary Bar */}
      <div className="px-4 py-2 bg-slate-950/90 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
        <span>Gemini 2.5 Pro Self-Healing Synthesis</span>
        <span className="font-mono text-slate-500">
          {lines.filter(l => l.startsWith('+') && !l.startsWith('+++')).length} additions,{' '}
          {lines.filter(l => l.startsWith('-') && !l.startsWith('---')).length} deletions
        </span>
      </div>
    </div>
  );
};
