'use client';

import React from 'react';
import { ShieldCheck, Check, X, AlertTriangle, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { IncidentStatus } from '../types';

interface HumanApprovalBarProps {
  incidentId: string;
  status: IncidentStatus;
  onApprove: () => void;
  onReject: () => void;
  isProcessing: boolean;
  blastScore: number;
  targetFile?: string;
}

export const HumanApprovalBar: React.FC<HumanApprovalBarProps> = ({
  incidentId,
  status,
  onApprove,
  onReject,
  isProcessing,
  blastScore,
  targetFile
}) => {
  const needsApproval = status === 'NEEDS_APPROVAL';
  const isResolved = status === 'RESOLVED';
  const isEscalated = status === 'ESCALATED';

  if (!needsApproval && !isResolved && !isEscalated) {
    return null;
  }

  return (
    <div className={`p-5 rounded-xl border transition-all duration-300 shadow-2xl backdrop-blur-md ${
      needsApproval
        ? 'bg-gradient-to-r from-amber-950/40 via-slate-900/90 to-amber-950/40 border-amber-500/50 ring-1 ring-amber-500/20'
        : isResolved
        ? 'bg-emerald-950/30 border-emerald-500/40'
        : 'bg-rose-950/30 border-rose-500/40'
    }`}>
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
        
        {/* State Information */}
        <div className="flex items-start space-x-3.5">
          <div className={`p-2.5 rounded-lg border ${
            needsApproval
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 animate-pulse'
              : isResolved
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
          }`}>
            {needsApproval ? (
              <AlertTriangle className="w-5 h-5" />
            ) : isResolved ? (
              <ShieldCheck className="w-5 h-5" />
            ) : (
              <X className="w-5 h-5" />
            )}
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase">
                LangGraph Human-in-the-Loop Gate
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                needsApproval
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : isResolved
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}>
                {status.replace('_', ' ')}
              </span>
            </div>

            <h3 className="text-base font-bold text-white mt-0.5">
              {needsApproval
                ? "SRE Sign-Off Required: Review & Authorize Autonomous Production Patch"
                : isResolved
                ? "Incident Successfully Resolved & Autonomous Fix Permanently Deployed"
                : "Incident Escalated to On-Call SRE Engineer"}
            </h3>

            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              {needsApproval
                ? `The cyclic self-healing agent synthesized a defensive patch${targetFile ? ` for ${targetFile}` : ''} and passed isolated unit tests. Blast Radius impact is rated at ${blastScore}/100.`
                : isResolved
                ? "Changes committed to Git repository with autonomous tag. Transcoder worker pods recovered."
                : "Remediation was halted. Diagnostic bundle compiled for incident responders."}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        {needsApproval && (
          <div className="flex items-center space-x-3 w-full lg:w-auto justify-end">
            <button
              onClick={onReject}
              disabled={isProcessing}
              className="px-4 py-2.5 rounded-lg border border-rose-500/30 bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 hover:text-white text-xs font-bold transition-all duration-200 flex items-center space-x-1.5 disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reject & Rollback</span>
            </button>

            <button
              onClick={onApprove}
              disabled={isProcessing}
              className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all duration-200 flex items-center space-x-2 shadow-lg shadow-emerald-600/30 hover:shadow-emerald-600/50 border border-emerald-400/40 active:scale-95 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Resuming LangGraph Deploy...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Approve & Deploy Fix</span>
                </>
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
