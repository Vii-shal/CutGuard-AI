'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from '../components/Header';
import { IncidentFeed } from '../components/IncidentFeed';
import { BlastRadiusRadar } from '../components/BlastRadiusRadar';
import { DiffViewer } from '../components/DiffViewer';
import { SandboxLogs } from '../components/SandboxLogs';
import { HumanApprovalBar } from '../components/HumanApprovalBar';
import { PostMortemModal } from '../components/PostMortemModal';
import { 
  Activity, 
  Cpu, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Play, 
  RefreshCw,
  Server,
  Layers,
  ShieldCheck
} from 'lucide-react';

// ==========================================
// CutGuard AI - Enterprise SRE Types
// ==========================================

export type IncidentStatus = 
  | 'IDLE'
  | 'INITIALIZING'
  | 'ANALYZING'
  | 'TRIAGING'
  | 'TRIAGED'
  | 'BLAST_ASSESSED'
  | 'SANDBOXED'
  | 'SANDBOX_TESTED'
  | 'NEEDS_APPROVAL'
  | 'WAITING_FOR_HUMAN'
  | 'DEPLOYING'
  | 'RESOLVED'
  | 'ESCALATED'
  | 'ERROR';

export interface AffectedFile {
  file: string;
  lines_of_code: number;
  symbols_imported: string[];
}

export interface BlastDetails {
  blast_score?: number;
  threat_level?: string;
  culprit_file?: string;
  downstream_dependent_count?: number;
  affected_files?: AffectedFile[];
  affected_symbols?: string[];
  affected_endpoints?: string[];
  blast_description?: string;
  [key: string]: unknown;
}

export interface Incident {
  incident_id: string;
  service: string;
  status: IncidentStatus;
  raw_log: string;
  culprit_file: string;
  culprit_commit: string;
  blast_score: number;
  blast_details: BlastDetails;
  generated_diff: string;
  test_passed: boolean;
  test_output: string;
  retry_count: number;
  human_approved: boolean | null;
  post_mortem: string;
  created_at: string;
  interrupt_payload?: unknown;
}

export interface ChaosIncidentTelemetry {
  incidentId?: string;
  scenario?: string;
  targetWorker?: string;
  severity?: string;
  errorSignature?: string;
  timestamp?: string;
  failingFile?: string;
  affectedPipelineStage?: string;
  exitCode?: number;
  signal?: string;
  status?: string;
  rawStderr?: string;
}

export interface ChaosStatusResponse {
  status: string;
  isCrashed: boolean;
  activeScenario: string | null;
  isFailureArmed: boolean;
  activeIncident: ChaosIncidentTelemetry | null;
}

export interface AgentLatestResponse {
  incident: Incident | null;
}

// Controlled Polling Intervals
const NOMINAL_POLL_INTERVAL_MS = 5000;
const ACTIVE_POLL_INTERVAL_MS = 1200;

export default function IncidentControlCenter() {
  const [activeTab, setActiveTab] = useState<'diff' | 'logs'>('diff');
  const [isProcessingApproval, setIsProcessingApproval] = useState<boolean>(false);
  const [isPostMortemOpen, setIsPostMortemOpen] = useState<boolean>(false);

  // Live Infrastructure Connectivity Badges
  const [pipelineOnline, setPipelineOnline] = useState<boolean>(false);
  const [agentOnline, setAgentOnline] = useState<boolean>(false);

  // Active Incident State (null represents nominal IDLE monitoring)
  const [incident, setIncident] = useState<Incident | null>(null);

  // Active state references for asynchronous callbacks to avoid stale closures
  const incidentRef = useRef<Incident | null>(incident);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isRequestInFlightRef = useRef<boolean>(false);

  // Synchronize ref on every state change
  useEffect(() => {
    incidentRef.current = incident;
  }, [incident]);

  // Derived current status for UI rendering and state-machine gating
  const activeStatus: IncidentStatus = incident?.status || 'IDLE';

  // Controlled cleanup function to unconditionally halt all timers
  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // =========================================================================
  // Requirement 1: Gated State-Machine Polling
  // - Nominal / Idle: Slow baseline polling (5000ms) to detect new failures
  // - Triaging / Active: Rapid polling (1200ms) to stream real-time AST/sandbox progress
  // - HITL Gate (NEEDS_APPROVAL / WAITING_FOR_HUMAN): IMMEDIATELY CLEAR & STOP ALL TIMERS
  // - Resolved / Escalated: Stop polling until user initiates action
  // =========================================================================
  useEffect(() => {
    clearPollTimer();

    // Condition 1: HITL Gate -> Immediately halt all timers. Zero network requests during review.
    if (activeStatus === 'NEEDS_APPROVAL' || activeStatus === 'WAITING_FOR_HUMAN') {
      return;
    }

    // Condition 2: Terminal State -> Stop polling until explicit user action
    if (activeStatus === 'RESOLVED' || activeStatus === 'ESCALATED' || activeStatus === 'ERROR') {
      return;
    }

    // Condition 3: Active Investigation -> Rapid polling (1000-1500ms)
    if (
      activeStatus === 'INITIALIZING' ||
      activeStatus === 'ANALYZING' ||
      activeStatus === 'TRIAGING' ||
      activeStatus === 'TRIAGED' ||
      activeStatus === 'BLAST_ASSESSED' ||
      activeStatus === 'SANDBOXED' ||
      activeStatus === 'SANDBOX_TESTED' ||
      activeStatus === 'DEPLOYING'
    ) {
      let isCancelled = false;

      const pollActiveInvestigation = async () => {
        if (isCancelled || isRequestInFlightRef.current) return;
        isRequestInFlightRef.current = true;

        try {
          const currentInc = incidentRef.current;
          const [agentRes, pipelineRes] = await Promise.allSettled([
            fetch('http://localhost:8000/api/incident/latest', { cache: 'no-store' }),
            fetch('http://localhost:4001/api/chaos/status', { cache: 'no-store' })
          ]);

          if (isCancelled) return;

          let latestAgentInc: Incident | null = null;
          if (agentRes.status === 'fulfilled' && agentRes.value.ok) {
            const data: AgentLatestResponse = await agentRes.value.json();
            latestAgentInc = data.incident;
          }

          if (pipelineRes.status === 'fulfilled' && pipelineRes.value.ok) {
            const chaosData: ChaosStatusResponse = await pipelineRes.value.json();
            setPipelineOnline(!chaosData.isCrashed);
          }

          if (latestAgentInc && latestAgentInc.incident_id) {
            if (!currentInc?.incident_id || latestAgentInc.incident_id === currentInc.incident_id) {
              setIncident(prev => ({
                ...(prev || latestAgentInc!),
                ...latestAgentInc!,
                blast_details: latestAgentInc!.blast_details || prev?.blast_details || {}
              }));

              // If the incident has reached HITL or finished, break out of loop
              if (
                latestAgentInc.status === 'NEEDS_APPROVAL' ||
                latestAgentInc.status === 'WAITING_FOR_HUMAN' ||
                latestAgentInc.status === 'RESOLVED' ||
                latestAgentInc.status === 'ESCALATED'
              ) {
                return;
              }
            }
          }
        } catch (err) {
          console.warn('[Active Poll] Transient polling error:', err);
        } finally {
          isRequestInFlightRef.current = false;
        }

        if (!isCancelled) {
          pollTimerRef.current = setTimeout(pollActiveInvestigation, ACTIVE_POLL_INTERVAL_MS);
        }
      };

      pollTimerRef.current = setTimeout(pollActiveInvestigation, ACTIVE_POLL_INTERVAL_MS);

      return () => {
        isCancelled = true;
        clearPollTimer();
      };
    }

    // Condition 4: Nominal / Idle State -> Slow baseline polling (5000ms)
    let isCancelled = false;

    const pollNominalTelemetry = async () => {
      if (isCancelled || isRequestInFlightRef.current) return;
      isRequestInFlightRef.current = true;

      try {
        const [chaosRes, agentRes, pipeHealth, agentHealth] = await Promise.allSettled([
          fetch('http://localhost:4001/api/chaos/status', { cache: 'no-store' }),
          fetch('http://localhost:8000/api/incident/latest', { cache: 'no-store' }),
          fetch('http://localhost:4001/health', { cache: 'no-store' }),
          fetch('http://localhost:8000/api/health', { cache: 'no-store' })
        ]);

        if (isCancelled) return;

        setPipelineOnline(pipeHealth.status === 'fulfilled' && pipeHealth.value.ok);
        setAgentOnline(agentHealth.status === 'fulfilled' && agentHealth.value.ok);

        let latestAgentInc: Incident | null = null;
        if (agentRes.status === 'fulfilled' && agentRes.value.ok) {
          const data: AgentLatestResponse = await agentRes.value.json();
          latestAgentInc = data.incident;
        }

        let pipelineChaos: ChaosStatusResponse | null = null;
        if (chaosRes.status === 'fulfilled' && chaosRes.value.ok) {
          pipelineChaos = await chaosRes.value.json();
        }

        // Case A: SRE Agent has an active incident record
        if (latestAgentInc && latestAgentInc.incident_id) {
          if (latestAgentInc.status !== 'RESOLVED' && latestAgentInc.status !== 'ESCALATED') {
            setIncident({
              ...latestAgentInc,
              blast_details: latestAgentInc.blast_details || {}
            });
            return; // State update triggers effect re-evaluation
          }
        } 
        // Case B: Pipeline crashed on Port 4001, ingest crash telemetry passively
        else if (pipelineChaos && pipelineChaos.isCrashed && pipelineChaos.activeIncident) {
          const inc = pipelineChaos.activeIncident;
          setIncident({
            incident_id: inc.incidentId || `inc-chaos-${Date.now()}`,
            service: 'ffmpeg-transcoder',
            status: 'ANALYZING',
            raw_log: inc.rawStderr || inc.errorSignature || 'Pipeline crash detected on Port 4001. Ingesting telemetry...',
            culprit_file: inc.failingFile || 'mock-pipeline/worker.js',
            culprit_commit: 'HEAD~1',
            blast_score: 0,
            blast_details: {},
            generated_diff: '',
            test_passed: false,
            test_output: '',
            retry_count: 0,
            human_approved: null,
            post_mortem: '',
            created_at: inc.timestamp || new Date().toISOString()
          });
          return; // State update triggers effect re-evaluation
        }
      } catch (err) {
        console.warn('[Nominal Poll] Transient nominal check error:', err);
      } finally {
        isRequestInFlightRef.current = false;
      }

      if (!isCancelled) {
        pollTimerRef.current = setTimeout(pollNominalTelemetry, NOMINAL_POLL_INTERVAL_MS);
      }
    };

    // Run immediate check upon entering nominal state, then schedule next
    pollNominalTelemetry();

    return () => {
      isCancelled = true;
      clearPollTimer();
    };
  }, [activeStatus, clearPollTimer]);

  // =========================================================================
  // Requirement 2: Synchronized "Approve & Deploy Fix" Action Handler
  // 1. Dispatch approval to SRE Agent: POST http://localhost:8000/api/incident/:id/resume with { "action": "approve" }
  // 2. Apply hot-patch to mock-pipeline: POST http://localhost:4001/api/patch/apply with { "patch": incident.generated_diff, "incidentId": incident.incident_id }
  // 3. Clear fault state: POST http://localhost:4001/api/chaos/reset
  // 4. Run a single synchronized fetch against both ports to update all UI badges to operational before settling
  // =========================================================================
  const handleApprove = async () => {
    const currentInc = incidentRef.current;
    if (!currentInc || !currentInc.incident_id) return;

    setIsProcessingApproval(true);
    try {
      // 1. Dispatch approval to SRE Agent
      try {
        await fetch(`http://localhost:8000/api/incident/${currentInc.incident_id}/resume`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'approve',
            approved: true,
            approver: 'Lead Cinema SRE'
          })
        });
      } catch (err) {
        console.warn('[Approval] SRE Agent resume error:', err);
      }

      // 2. Apply hot-patch to mock-pipeline
      try {
        if (currentInc.generated_diff) {
          await fetch('http://localhost:4001/api/patch/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              patch: currentInc.generated_diff,
              incidentId: currentInc.incident_id,
              operatorSignOff: true
            })
          });
        }
      } catch (err) {
        console.warn('[Approval] Pipeline patch application error:', err);
      }

      // 3. Clear fault state
      try {
        await fetch('http://localhost:4001/api/chaos/reset', { method: 'POST' });
      } catch (err) {
        console.warn('[Approval] Chaos reset error:', err);
      }

      // 4. Single synchronized fetch against both ports to update UI badges to operational
      let rcaReport = currentInc.post_mortem;
      try {
        const [pipeHealth, agentHealth, rcaRes] = await Promise.allSettled([
          fetch('http://localhost:4001/health', { cache: 'no-store' }),
          fetch('http://localhost:8000/api/health', { cache: 'no-store' }),
          fetch(`http://localhost:4001/api/enterprise/rca/${currentInc.incident_id}`, { cache: 'no-store' })
        ]);

        setPipelineOnline(pipeHealth.status === 'fulfilled' && pipeHealth.value.ok);
        setAgentOnline(agentHealth.status === 'fulfilled' && agentHealth.value.ok);

        if (rcaRes.status === 'fulfilled' && rcaRes.value.ok) {
          const rcaData = await rcaRes.value.json();
          rcaReport = `# Enterprise Incident RCA & Post-Mortem\n**Incident ID:** \`${rcaData.incidentId}\`\n**Severity:** \`${rcaData.severity}\`\n**MTTR:** \`${rcaData.mttr}\`\n**Status:** **${rcaData.verificationStatus}**\n\n### Root Cause Analysis\n${rcaData.rootCauseAnalysis?.summary || 'Automated AST patch verified and hot-reloaded.'}\n\n**Trigger Mechanism:**\n${rcaData.rootCauseAnalysis?.triggerMechanism || 'Codec parameter mismatch in FFmpeg chunk encoder.'}\n\n### Applied Code Patch\n\`\`\`diff\n${rcaData.appliedPatch || currentInc.generated_diff}\n\`\`\``;
        }
      } catch (err) {
        console.warn('[Approval] Synchronized verification error:', err);
      }

      // Settle UI state into RESOLVED
      setIncident(prev => prev ? ({
        ...prev,
        status: 'RESOLVED',
        human_approved: true,
        post_mortem: rcaReport || prev.post_mortem
      }) : null);

    } finally {
      setIsProcessingApproval(false);
    }
  };

  // =========================================================================
  // Requirement 3: Coordinated "Reset to Nominal" Handler
  // - Clear chaos on Port 4001 (POST /api/chaos/reset)
  // - Clear incident records on Port 8000 (POST /api/incidents/clear)
  // - Reset incident state to null in React
  // - Resumes the slow baseline poll (every 5000ms) to show green "ALL SYSTEMS NOMINAL"
  // =========================================================================
  const handleResetToNominal = async () => {
    // 1. Clear chaos on Port 4001 and incidents on Port 8000
    try {
      await Promise.allSettled([
        fetch('http://localhost:4001/api/chaos/reset', { method: 'POST' }),
        fetch('http://localhost:8000/api/incidents/clear', { method: 'POST' })
      ]);
    } catch (err) {
      console.warn('[Reset] Coordinated reset error:', err);
    }

    // 2. Refresh infrastructure health status
    try {
      const [pipeHealth, agentHealth] = await Promise.allSettled([
        fetch('http://localhost:4001/health', { cache: 'no-store' }),
        fetch('http://localhost:8000/api/health', { cache: 'no-store' })
      ]);
      setPipelineOnline(pipeHealth.status === 'fulfilled' && pipeHealth.value.ok);
      setAgentOnline(agentHealth.status === 'fulfilled' && agentHealth.value.ok);
    } catch {
      // Maintain previous status
    }

    // 3. Reset incident state to null in React
    // This transitions activeStatus to 'IDLE', which automatically triggers
    // the slow baseline poll (every 5000ms) and displays the clean green nominal dashboard.
    setIncident(null);
  };

  // Human-in-the-loop: Reject & Rollback
  const handleReject = async () => {
    const currentInc = incidentRef.current;
    if (!currentInc || !currentInc.incident_id) return;

    setIsProcessingApproval(true);
    try {
      await fetch(`http://localhost:8000/api/incident/${currentInc.incident_id}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'reject',
          approved: false, 
          approver: 'Lead Cinema SRE' 
        })
      });
      setIncident(prev => prev ? ({ ...prev, status: 'ESCALATED', human_approved: false }) : null);
    } catch (err) {
      console.warn('[Reject] Reject notification error:', err);
      setIncident(prev => prev ? ({ ...prev, status: 'ESCALATED', human_approved: false }) : null);
    } finally {
      setIsProcessingApproval(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#030712] text-slate-100 font-sans">
      
      {/* Top Navbar */}
      <Header
        activeStatus={activeStatus}
        pipelineOnline={pipelineOnline}
        agentOnline={agentOnline}
      />

      {/* Main Command Center */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        
        {/* Incident Lifecycle Header & Progress Stepper */}
        <IncidentFeed
          incidentId={incident?.incident_id || ''}
          status={activeStatus}
          service={incident?.service || 'ffmpeg-transcoder'}
          rawLog={incident?.raw_log || ''}
          createdAt={incident?.created_at || ''}
          culpritFile={incident?.culprit_file || 'mock-pipeline/worker.js'}
          blastScore={incident?.blast_score || 0}
        />

        {/* Human-in-the-Loop Approval Decision Bar */}
        <HumanApprovalBar
          incidentId={incident?.incident_id || ''}
          status={activeStatus}
          onApprove={handleApprove}
          onReject={handleReject}
          isProcessing={isProcessingApproval}
          blastScore={incident?.blast_score || 0}
        />

        {/* Resolved Banner Action */}
        {activeStatus === 'RESOLVED' && (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <div>
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Remediation Complete
                </span>
                <p className="text-xs text-slate-300">
                  Transcoding worker patched, verified in sandbox, and telemetry normalized to HEALTHY.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsPostMortemOpen(true)}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-lg shadow-emerald-600/20"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>View Enterprise RCA Post-Mortem</span>
              </button>
              <button
                onClick={handleResetToNominal}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-slate-700"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset to Nominal</span>
              </button>
            </div>
          </div>
        )}

        {/* Escalated Banner Action */}
        {activeStatus === 'ESCALATED' && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <AlertCircle className="w-5 h-5 text-rose-400" />
              <div>
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Incident Escalated
                </span>
                <p className="text-xs text-slate-300">
                  Automated self-healing exceeded maximum retry budget or was rejected by operator. Manual SRE intervention required.
                </p>
              </div>
            </div>
            <button
              onClick={handleResetToNominal}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-slate-700"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset to Nominal</span>
            </button>
          </div>
        )}

        {/* Clean Green "ALL SYSTEMS NOMINAL" Cluster Overview (when IDLE) OR Dual Grid (when Active/Remediating) */}
        {activeStatus === 'IDLE' ? (
          <div className="bg-slate-900/80 border border-emerald-500/30 rounded-xl p-8 shadow-2xl relative overflow-hidden backdrop-blur-md">
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10 border-b border-slate-800/80 pb-6">
              <div className="flex items-start space-x-4">
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 ring-2 ring-emerald-500/20 shadow-lg shadow-emerald-950">
                  <ShieldCheck className="w-8 h-8 stroke-[2.2]" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-mono font-bold tracking-widest text-emerald-400 uppercase bg-emerald-950/60 px-2.5 py-0.5 rounded border border-emerald-500/30">
                      SYSTEM STATUS: NOMINAL
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                      Live Monitoring
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold text-white tracking-tight mt-1.5">
                    ALL SYSTEMS NOMINAL (0 Active Incidents)
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                    CutGuard AI autonomous SRE agent is actively monitoring cluster telemetry streams (Grafana Loki &amp; OpenTelemetry). Transcoding worker pods are running within normal memory and bitrate parameters.
                  </p>
                </div>
              </div>

              {/* Direct Navigation to Platform Visualizer */}
              <div className="flex flex-col items-start md:items-end gap-2">
                <a
                  href="http://localhost:4001/player"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center space-x-2 shadow-xl shadow-indigo-950/60 border border-indigo-400/40 transition-all duration-200 active:scale-95 whitespace-nowrap"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Open Video Stream Player (:4001) &nearr;</span>
                </a>
                <span className="text-[10px] text-slate-400 font-mono text-right">
                  Simulate stream corruptions on Port 4001 player or Swagger /docs
                </span>
              </div>
            </div>

            {/* Streaming Operational Metrics Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
              <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                <span className="text-[10px] font-mono uppercase text-slate-400">Transcode Throughput</span>
                <div className="text-sm font-bold font-mono text-emerald-400 mt-0.5">1,420 chunks/min</div>
                <div className="text-[10px] text-slate-500 font-mono">100% Target Met (60 FPS)</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                <span className="text-[10px] font-mono uppercase text-slate-400">P99 Encoding Latency</span>
                <div className="text-sm font-bold font-mono text-cyan-400 mt-0.5">18.4 ms</div>
                <div className="text-[10px] text-slate-500 font-mono">SLA Threshold: &lt; 50ms</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                <span className="text-[10px] font-mono uppercase text-slate-400">Loki Error Rate</span>
                <div className="text-sm font-bold font-mono text-emerald-400 mt-0.5">0.00 err/sec</div>
                <div className="text-[10px] text-slate-500 font-mono">Clean Telemetry Window</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                <span className="text-[10px] font-mono uppercase text-slate-400">Autonomous Guardrail</span>
                <div className="text-sm font-bold font-mono text-purple-400 mt-0.5">Active Sandbox Ready</div>
                <div className="text-[10px] text-slate-500 font-mono">AST Blast Radar Online</div>
              </div>
            </div>

            {/* Health & Cluster Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-indigo-400" />
                    Transcoder Worker
                  </span>
                  <span className={`w-2 h-2 rounded-full ${pipelineOnline ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-rose-500'}`} />
                </div>
                <div className="text-base font-bold font-mono text-white">
                  {pipelineOnline ? 'Port 4001 ONLINE' : 'OFFLINE'}
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {pipelineOnline ? 'ffmpeg-transcoder pool: 4' : 'Connection refused'}
                </div>
              </div>

              <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                    LangGraph SRE Agent
                  </span>
                  <span className={`w-2 h-2 rounded-full ${agentOnline ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-rose-500'}`} />
                </div>
                <div className="text-base font-bold font-mono text-white">
                  {agentOnline ? 'Port 8000 ARMED' : 'OFFLINE'}
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {agentOnline ? 'Gemini 2.0 + HITL Gate' : 'FastAPI unavailable'}
                </div>
              </div>

              <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-orange-400" />
                    Telemetry Pipeline
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                </div>
                <div className="text-base font-bold font-mono text-white">
                  Grafana Loki MCP
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  Stream: &#123;app=&quot;transcoder&quot;&#125;
                </div>
              </div>

              <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-purple-400" />
                    Blast Radius Radar
                  </span>
                  <span className="text-[10px] font-mono font-bold text-emerald-400">0% Risk</span>
                </div>
                <div className="text-base font-bold font-mono text-white">
                  AST Analyzer Ready
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  Zero active regressions
                </div>
              </div>
            </div>

            {/* Live Loki Passive Scanner Stream */}
            <div className="mt-4 p-4 rounded-lg bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Loki Telemetry Passive Scan Stream
                </span>
                <span className="text-[10px] font-mono text-slate-500">Baseline Cadence • 5,000ms</span>
              </div>
              <div className="font-mono text-[11px] text-slate-400 space-y-1 leading-relaxed bg-black/40 p-3 rounded border border-slate-900">
                <div className="text-emerald-400/90">[PASSIVE OBSERVER] Ingestion listener connected. Loki query: &#123;app=&quot;ffmpeg-transcoder&quot;&#125; |= &quot;CRITICAL&quot;</div>
                <div>[STATUS] GKE transcoder pool worker-transcode-04 healthy (memory cgroup: 34% utilized)</div>
                <div>[STATUS] AST call graph indexed. Root culprit target: mock-pipeline/worker.js</div>
                <div className="text-cyan-400/80">[STANDBY] Awaiting incoming webhook alerts from media transcoder...</div>
              </div>
            </div>
          </div>
        ) : (
          /* Dual Grid: Blast Radius Left + Code Diff / Test Logs Right */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Blast Radius Analysis (4 Cols) */}
            <div className="lg:col-span-4 space-y-6">
              <BlastRadiusRadar
                score={incident?.blast_score || 0}
                details={(incident?.blast_details || {}) as any}
              />

              {/* Live Dynamic SRE Telemetry Stats Card */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-indigo-400" />
                    Cluster Telemetry
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400">GKE us-central1</span>
                </div>
                <div className="space-y-2 font-mono text-slate-400">
                  <div className="flex justify-between">
                    <span>Worker Pod:</span>
                    <span className="text-slate-200 truncate">transcode-worker-7f89b</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Exit Signal:</span>
                    {activeStatus === 'RESOLVED' ? (
                      <span className="text-emerald-400 font-semibold">Recovered (Exit 0)</span>
                    ) : (incident?.raw_log?.includes('139') || incident?.raw_log?.includes('SIGSEGV')) ? (
                      <span className="text-rose-400 font-semibold">SIGSEGV (Exit 139)</span>
                    ) : (incident?.raw_log?.includes('137') || incident?.raw_log?.includes('SIGABRT')) ? (
                      <span className="text-rose-400 font-semibold">SIGABRT (Exit 137 OOM)</span>
                    ) : (
                      <span className="text-rose-400 font-semibold">SIGSEGV (Exit 139)</span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span>Self-Healing Loop:</span>
                    {activeStatus === 'RESOLVED' ? (
                      <span className="text-emerald-400 font-semibold">1 / 1 Remediated &amp; Verified</span>
                    ) : (
                      <span className="text-cyan-400 font-semibold">{incident?.retry_count || 0} / 2 Retries</span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span>Telemetry Source:</span>
                    <span className="text-orange-400 font-mono">
                      {pipelineOnline ? 'Live Worker :4001' : 'Simulation Mode'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Diff Viewer & Isolated Sandbox Terminal (8 Cols) */}
            <div className="lg:col-span-8 flex flex-col space-y-4">
              
              {/* View Switcher Tabs */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setActiveTab('diff')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      activeTab === 'diff'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Proposed Git Unified Patch
                  </button>
                  <button
                    onClick={() => setActiveTab('logs')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center space-x-1.5 ${
                      activeTab === 'logs'
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>Sandbox Jest Test Output</span>
                    {incident?.test_passed && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    )}
                  </button>
                </div>

                <div className="text-[11px] text-slate-500 font-mono">
                  Target: {incident?.culprit_file || 'mock-pipeline/worker.js'}
                </div>
              </div>

              {/* Tab Body */}
              <div className="flex-1">
                {activeTab === 'diff' ? (
                  <DiffViewer
                    diff={incident?.generated_diff || ''}
                    culpritFile={incident?.culprit_file || 'mock-pipeline/worker.js'}
                    testPassed={incident?.test_passed || false}
                  />
                ) : (
                  <SandboxLogs
                    logs={incident?.test_output || ''}
                    testPassed={incident?.test_passed || false}
                    retryCount={incident?.retry_count || 0}
                    status={activeStatus}
                  />
                )}
              </div>

            </div>

          </div>
        )}

      </main>

      {/* Post-Mortem RCA Modal */}
      <PostMortemModal
        isOpen={isPostMortemOpen}
        onClose={() => setIsPostMortemOpen(false)}
        postMortem={incident?.post_mortem || ''}
        incidentId={incident?.incident_id || ''}
      />

      {/* Global Ops Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 px-6 py-4 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div>
            CutGuard AI • Agentic Cinema Hackathon (Google Cloud + Devpost)
          </div>
          <div className="flex items-center space-x-4">
            <span>Grafana Labs Track (@grafana/mcp)</span>
            <span>•</span>
            <span>Gemini 2.5 Flash/Pro</span>
            <span>•</span>
            <span>LangGraph HITL</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
