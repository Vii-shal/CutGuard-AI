'use client';

import React from 'react';
import { 
  AlertCircle, 
  Terminal, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  Layers, 
  Activity, 
  CheckCircle2, 
  Loader2, 
  FileCode,
  ShieldAlert
} from 'lucide-react';

interface IncidentFeedProps {
  incidentId: string;
  status: string;
  service: string;
  rawLog: string;
  createdAt: string;
  culpritFile: string;
  blastScore: number;
}

const STAGES = [
  { key: 'ANALYZING', label: '1. Ingest Telemetry', desc: 'Grafana Loki MCP' },
  { key: 'TRIAGED', label: '2. Gemini Triage', desc: 'Isolate Root Cause' },
  { key: 'BLAST_ASSESSED', label: '3. Blast Radius', desc: 'AST Call Graph' },
  { key: 'SANDBOXED', label: '4. Sandbox Heal', desc: 'Jest Unit Test Loop' },
  { key: 'NEEDS_APPROVAL', label: '5. SRE Gate', desc: 'LangGraph Interrupt' },
  { key: 'RESOLVED', label: '6. Production Deploy', desc: 'Commit & Tag' },
];

export const IncidentFeed: React.FC<IncidentFeedProps> = ({
  incidentId,
  status,
  service,
  rawLog,
  createdAt,
  culpritFile,
  blastScore
}) => {
  const [showLog, setShowLog] = React.useState(true);

  const getStageIndex = (currStatus: string) => {
    switch (currStatus) {
      case 'ANALYZING': return 0;
      case 'TRIAGED': return 1;
      case 'BLAST_ASSESSED': return 2;
      case 'SANDBOXED': return 3;
      case 'NEEDS_APPROVAL': return 4;
      case 'RESOLVED': return 5;
      default: return 0;
    }
  };

  const activeIndex = getStageIndex(status);

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl space-y-5">
      
      {/* Top Banner: Incident Meta */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-bold text-white">
                {incidentId || "NO ACTIVE INCIDENT"}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                {service}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Triggered: {createdAt ? new Date(createdAt).toLocaleTimeString() : 'Awaiting Simulation'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Lifecycle State:
          </span>
          <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
            status === 'RESOLVED'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : status === 'NEEDS_APPROVAL'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
              : status === 'ESCALATED'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
          }`}>
            {status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Progress Stepper */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {STAGES.map((stg, i) => {
          const isDone = i < activeIndex || status === 'RESOLVED';
          const isCurrent = i === activeIndex && status !== 'RESOLVED';

          return (
            <div
              key={stg.key}
              className={`p-2.5 rounded-lg border transition-all text-left ${
                isDone
                  ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                  : isCurrent
                  ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-200 ring-1 ring-cyan-500/20'
                  : 'bg-slate-950/40 border-slate-800/80 text-slate-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold tracking-tight">
                  {stg.label}
                </span>
                {isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : isCurrent ? (
                  <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-slate-700" />
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-1 truncate">
                {stg.desc}
              </p>
            </div>
          );
        })}
      </div>

      {/* Raw Grafana Log Expandable Viewer */}
      <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/80">
        <button
          onClick={() => setShowLog(!showLog)}
          className="w-full px-3 py-2 flex items-center justify-between text-xs font-semibold text-slate-300 hover:bg-slate-900/60 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <Terminal className="w-3.5 h-3.5 text-orange-400" />
            <span>Grafana Loki Log Stream Telemetry</span>
            <span className="text-[10px] font-mono text-orange-400/80 font-normal">
              &#123;app=&quot;{service}&quot;&#125; |= &quot;CRITICAL&quot;
            </span>
          </div>
          {showLog ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {showLog && (
          <div className="p-3 border-t border-slate-800/80 font-mono text-xs text-slate-300 max-h-48 overflow-y-auto bg-black/40 leading-relaxed whitespace-pre-wrap">
            {rawLog || "Awaiting incident logs from Grafana MCP..."}
          </div>
        )}
      </div>

    </div>
  );
};
