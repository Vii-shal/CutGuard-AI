'use client';

import React from 'react';
import { FileText, X, Download, CheckCircle2, Shield, GitPullRequest } from 'lucide-react';

interface PostMortemModalProps {
  isOpen: boolean;
  onClose: () => void;
  postMortem: string;
  incidentId: string;
  prUrl?: string | null;
  prNumber?: number | null;
}

export const PostMortemModal: React.FC<PostMortemModalProps> = ({
  isOpen,
  onClose,
  postMortem,
  incidentId,
  prUrl,
  prNumber
}) => {
  if (!isOpen) return null;

  const handleDownload = () => {
    const blob = new Blob([postMortem], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CutGuard-RCA-${incidentId}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Enterprise SRE Post-Mortem & RCA
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-normal">
                  RESOLVED
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Incident: {incidentId}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {prUrl && (
              <a
                href={prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg border border-indigo-500/40 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 hover:text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-sm"
              >
                <GitPullRequest className="w-3.5 h-3.5" />
                <span>View GitHub PR {prNumber ? `#${prNumber}` : ''} ↗</span>
              </a>
            )}
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Markdown</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 font-sans text-sm text-slate-300 leading-relaxed bg-slate-950/50">
          <div className="prose prose-invert max-w-none prose-pre:bg-slate-950 prose-pre:border prose-pre:border-slate-800">
            <pre className="whitespace-pre-wrap font-mono text-xs bg-slate-950 p-5 rounded-xl border border-slate-800 text-slate-300 leading-relaxed">
              {postMortem || "Post-mortem compiling..."}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center space-x-1.5">
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            <span>Autonomous Cinema SRE Agent • CutGuard AI</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
