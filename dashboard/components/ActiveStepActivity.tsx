import React from 'react';
import { Loader2, CheckCircle2, AlertOctagon, Terminal } from 'lucide-react';

interface ActiveStepActivityProps {
  incident: {
    status?: string | null;
    lifecycle_state?: string | null;
    active_node?: string | null;
    culprit_file?: string | null;
    blast_score?: number | null;
    error_message?: string | null;
    test_output?: string | null;
    retry_count?: number | null;
  } | null;
}

const NODE_DESCRIPTIONS: Record<string, { label: string; action: string }> = {
  telemetry_ingest: {
    label: "Step 1: Telemetry Ingestion",
    action: "Querying Grafana Loki MCP for stack traces and exit code 139...",
  },
  analyzing: {
    label: "Step 1: Telemetry Ingestion",
    action: "Querying Grafana Loki MCP for stack traces and exit code 139...",
  },
  initializing: {
    label: "Step 1: Telemetry Ingestion",
    action: "Querying Grafana Loki MCP for stack traces and exit code 139...",
  },
  syncing: {
    label: "Step 1: Telemetry Ingestion",
    action: "Querying Grafana Loki MCP for stack traces and exit code 139...",
  },
  gemini_triage: {
    label: "Step 2: Root Cause Triage",
    action: "Gemini isolating FFmpeg codec profile conflict in worker logic...",
  },
  triage: {
    label: "Step 2: Root Cause Triage",
    action: "Gemini isolating FFmpeg codec profile conflict in worker logic...",
  },
  triaged: {
    label: "Step 2: Root Cause Triage",
    action: "Gemini isolating FFmpeg codec profile conflict in worker logic...",
  },
  blast_radius_ast: {
    label: "Step 3: AST Dependency Analysis",
    action: "Parsing call graph to assess downstream pipeline impact...",
  },
  blast_radius: {
    label: "Step 3: AST Dependency Analysis",
    action: "Parsing call graph to assess downstream pipeline impact...",
  },
  blast_assessed: {
    label: "Step 3: AST Dependency Analysis",
    action: "Parsing call graph to assess downstream pipeline impact...",
  },
  sandbox_patch: {
    label: "Step 4: Sandbox Verification",
    action: "Synthesizing unified patch and executing headless Jest test suite...",
  },
  sandboxed: {
    label: "Step 4: Sandbox Verification",
    action: "Synthesizing unified patch and executing headless Jest test suite...",
  },
  sandbox_tested: {
    label: "Step 4: Sandbox Verification",
    action: "Synthesizing unified patch and executing headless Jest test suite...",
  },
  human_approval_gate: {
    label: "Step 5: Human SRE Gate",
    action: "Automated regression tests passed. Awaiting operator sign-off...",
  },
  needs_approval: {
    label: "Step 5: Human SRE Gate",
    action: "Automated regression tests passed. Awaiting operator sign-off...",
  },
  waiting_for_human: {
    label: "Step 5: Human SRE Gate",
    action: "Automated regression tests passed. Awaiting operator sign-off...",
  },
  production_deploy: {
    label: "Step 6: Production Hot-Patch",
    action: "Hot-reloading runtime container and publishing GitHub PR...",
  },
  deploy: {
    label: "Step 6: Production Hot-Patch",
    action: "Hot-reloading runtime container and publishing GitHub PR...",
  },
  deploying: {
    label: "Step 6: Production Hot-Patch",
    action: "Hot-reloading runtime container and publishing GitHub PR...",
  },
  resolved: {
    label: "Step 6: Production Hot-Patch",
    action: "Hot-reloading runtime container and publishing GitHub PR...",
  },
};

export const ActiveStepActivity: React.FC<ActiveStepActivityProps> = ({ incident }) => {
  if (!incident) {
    return (
      <div className="w-full my-3 p-3 rounded-lg border border-slate-800 bg-slate-900/40 text-xs text-slate-500 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-slate-600 animate-pulse" />
        SRE Agent listening for telemetry events...
      </div>
    );
  }

  const isEscalated = incident.status === 'ESCALATED' || incident.lifecycle_state === 'ESCALATED';
  const isResolved = incident.status === 'RESOLVED' || incident.lifecycle_state === 'RESOLVED';
  const isPaused = incident.status === 'NEEDS_APPROVAL' || incident.lifecycle_state === 'NEEDS_APPROVAL';

  const currentKey = incident.active_node || incident.lifecycle_state?.toLowerCase() || incident.status?.toLowerCase() || '';
  const nodeConfig = NODE_DESCRIPTIONS[currentKey] || {
    label: incident.status || "Pipeline Execution",
    action: `Processing node: ${currentKey || 'in_progress'}`,
  };

  return (
    <div
      className={`w-full my-3 p-3.5 rounded-lg border transition-all text-sm backdrop-blur-md ${
        isEscalated
          ? 'border-red-500/40 bg-red-950/20 text-red-200'
          : isResolved
          ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200'
          : isPaused
          ? 'border-amber-500/40 bg-amber-950/20 text-amber-200'
          : 'border-cyan-500/30 bg-slate-900/60 text-slate-300'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {isEscalated ? (
            <AlertOctagon className="w-5 h-5 text-red-400 mt-0.5 shrink-0"/>
          ) : isResolved ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0"/>
          ) : (
            <Loader2 className="w-5 h-5 text-cyan-400 animate-spin mt-0.5 shrink-0"/>
          )}

          <div>
            <div className="font-medium flex items-center gap-2 text-xs tracking-wide">
              <span className="uppercase text-cyan-400 font-mono font-semibold">
                {nodeConfig.label}
              </span>
              {Boolean(incident.retry_count && incident.retry_count > 0) && (
                <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded text-[10px] font-mono">
                  Retry #{incident.retry_count}
                </span>
              )}
            </div>

            {isEscalated ? (
              <div className="text-red-300 text-xs mt-1 font-mono break-all">
                <span className="font-semibold text-red-400">Escalation Trigger: </span>
                {incident.error_message || incident.test_output || "Retry budget exhausted or validation rejected."}
              </div>
            ) : (
              <div className="text-slate-400 text-xs mt-1 font-mono">
                {nodeConfig.action}
              </div>
            )}
          </div>
        </div>

        {incident.culprit_file && !isEscalated && (
          <div className="hidden sm:flex items-center gap-1.5 text-slate-400 text-xs bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700 font-mono">
            <Terminal className="w-3.5 h-3.5 text-cyan-400"/>
            <span>{incident.culprit_file}</span>
            {incident.blast_score !== undefined && (
              <span className="text-amber-400 font-bold ml-1">({incident.blast_score}%)</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveStepActivity;
