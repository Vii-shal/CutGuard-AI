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

export interface WorkerPoolHealth {
  activeWorkers: number;
  totalCapacity: number;
  cluster?: string;
  nodeGroup?: string;
}

export interface WorkerChaosState {
  scenario?: string;
  activeIncidentId?: string | null;
}

export interface WorkerHealthResponse {
  status: 'healthy' | 'degraded' | string;
  service?: string;
  uptimeSeconds?: number;
  workerPool?: WorkerPoolHealth;
  ffmpegVersion?: string;
  codecsSupported?: string[];
  chaosState?: WorkerChaosState;
}

// Controlled Polling Intervals
const NOMINAL_POLL_INTERVAL_MS = 5000;
const ACTIVE_POLL_INTERVAL_MS = 1200;

// Infrastructure Endpoints
const PIPELINE_URL = process.env.NEXT_PUBLIC_PIPELINE_URL || 'http://localhost:4001';
const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || 'http://localhost:8000';

export default function IncidentControlCenter() {
  const [activeTab, setActiveTab] = useState<'diff' | 'logs'>('diff');
  const [isProcessingApproval, setIsProcessingApproval] = useState<boolean>(false);
  const [isPostMortemOpen, setIsPostMortemOpen] = useState<boolean>(false);

  // Live Infrastructure Connectivity Badges
  const [pipelineOnline, setPipelineOnline] = useState<boolean>(false);
  const [agentOnline, setAgentOnline] = useState<boolean>(false);

  // Worker / Cluster degradation state (separated from HTTP connectivity)
  const [isClusterDegraded, setIsClusterDegraded] = useState<boolean>(false);

  // Live Transcoder Worker Health payload from GET /health
  const [workerHealth, setWorkerHealth] = useState<WorkerHealthResponse | null>(null);

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
  // Requirement 1: Isolated Infrastructure Heartbeat Effect
  // Dedicated useEffect with a 4-second setInterval that probes:
  //   - Worker: ${PIPELINE_URL}/health
  //   - Agent:  ${AGENT_URL}/api/health
  // Sets pipelineOnline strictly based on workerRes.ok (green dot).
  // Sets agentOnline strictly based on agentRes.ok.
  // Parses live workerHealth and updates cluster degraded status.
  // =========================================================================
  useEffect(() => {
    let isMounted = true;

    const probeHealth = async () => {
      try {
        const [workerRes, agentRes] = await Promise.allSettled([
          fetch(`${PIPELINE_URL}/health`, { cache: 'no-store' }),
          fetch(`${AGENT_URL}/api/health`, { cache: 'no-store' })
        ]);

        if (!isMounted) return;

        const isPipelineOk = workerRes.status === 'fulfilled' && workerRes.value.ok;
        const isAgentOk = agentRes.status === 'fulfilled' && agentRes.value.ok;

        setPipelineOnline(isPipelineOk);
        setAgentOnline(isAgentOk);

        // Bind live /health payload from Port 4001
        if (isPipelineOk && workerRes.status === 'fulfilled') {
          try {
            const healthData: WorkerHealthResponse = await workerRes.value.json();
            setWorkerHealth(healthData);
            const isDegraded = healthData.status === 'degraded' || 
              Boolean(healthData.chaosState?.scenario && healthData.chaosState.scenario !== 'NONE');
            setIsClusterDegraded(isDegraded);
          } catch (err) {
            console.warn('[Heartbeat] Failed to parse worker health JSON:', err);
          }
        } else {
          setWorkerHealth(null);
          setIsClusterDegraded(false);
        }
      } catch {
        if (isMounted) {
          setPipelineOnline(false);
          setAgentOnline(false);
          setWorkerHealth(null);
          setIsClusterDegraded(false);
        }
      }
    };

    probeHealth();
    const intervalId = setInterval(probeHealth, 4000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  // =========================================================================
  // Requirement 3: Independent Incident Polling
  // - Nominal / Idle: Slow baseline polling (5000ms) to detect new failures
  // - Triaging / Active: Rapid polling (1200ms) to stream real-time AST/sandbox progress
  // - HITL Gate (NEEDS_APPROVAL / WAITING_FOR_HUMAN): IMMEDIATELY CLEAR & STOP ALL INCIDENT TIMERS
  // - Resolved / Escalated: Stop polling until user initiates action
  // When the incident pauses at NEEDS_APPROVAL, halting the incident poller
  // must NOT freeze or turn off the header health badges.
  // =========================================================================
  useEffect(() => {
    clearPollTimer();

    // Condition 1: HITL Gate -> Immediately halt incident timers. Zero network requests during review.
    // Halting incident poller does NOT freeze or turn off header health badges.
    if (activeStatus === 'NEEDS_APPROVAL' || activeStatus === 'WAITING_FOR_HUMAN') {
      return;
    }

    // Condition 2: Terminal State -> Stop polling until explicit user action
    if (activeStatus === 'RESOLVED' || activeStatus === 'ESCALATED' || activeStatus === 'ERROR') {
      return;
    }

    // Condition 3: Active Investigation -> Rapid polling (1200ms)
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
            fetch(`${AGENT_URL}/api/incident/latest`, { cache: 'no-store' }),
            fetch(`${PIPELINE_URL}/api/chaos/status`, { cache: 'no-store' })
          ]);

          if (isCancelled) return;

          if (pipelineRes.status === 'fulfilled' && pipelineRes.value.ok) {
            const chaosData: ChaosStatusResponse = await pipelineRes.value.json();
            setIsClusterDegraded(Boolean(chaosData.isCrashed || (chaosData.activeScenario && chaosData.activeScenario !== 'NONE')));
          }

          let latestAgentInc: Incident | null = null;
          if (agentRes.status === 'fulfilled' && agentRes.value.ok) {
            const data: AgentLatestResponse = await agentRes.value.json();
            latestAgentInc = data.incident;
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
        const [chaosRes, agentRes] = await Promise.allSettled([
          fetch(`${PIPELINE_URL}/api/chaos/status`, { cache: 'no-store' }),
          fetch(`${AGENT_URL}/api/incident/latest`, { cache: 'no-store' })
        ]);

        if (isCancelled) return;

        let pipelineChaos: ChaosStatusResponse | null = null;
        if (chaosRes.status === 'fulfilled' && chaosRes.value.ok) {
          const data: ChaosStatusResponse = await chaosRes.value.json();
          pipelineChaos = data;
          setIsClusterDegraded(Boolean(data.isCrashed || (data.activeScenario && data.activeScenario !== 'NONE')));
        } else {
          setIsClusterDegraded(false);
        }

        let latestAgentInc: Incident | null = null;
        if (agentRes.status === 'fulfilled' && agentRes.value.ok) {
          const data: AgentLatestResponse = await agentRes.value.json();
          latestAgentInc = data.incident;
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
          setIsClusterDegraded(true);
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
  // Synchronized "Approve & Deploy Fix" Action Handler
  // 1. Dispatch approval to SRE Agent: POST ${AGENT_URL}/api/incident/:id/resume
  // 2. Apply hot-patch to mock-pipeline: POST ${PIPELINE_URL}/api/patch/apply
  // 3. Clear fault state: POST ${PIPELINE_URL}/api/chaos/reset
  // 4. Retrieve enterprise RCA post-mortem report
  // =========================================================================
  const handleApprove = async () => {
    const currentInc = incidentRef.current;
    if (!currentInc || !currentInc.incident_id) return;

    setIsProcessingApproval(true);
    try {
      // 1. Dispatch approval to SRE Agent
      try {
        await fetch(`${AGENT_URL}/api/incident/${currentInc.incident_id}/resume`, {
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
          await fetch(`${PIPELINE_URL}/api/patch/apply`, {
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
        await fetch(`${PIPELINE_URL}/api/chaos/reset`, { method: 'POST' });
        setIsClusterDegraded(false);
      } catch (err) {
        console.warn('[Approval] Chaos reset error:', err);
      }

      // 4. Retrieve enterprise RCA post-mortem report
      let rcaReport = currentInc.post_mortem;
      try {
        const rcaRes = await fetch(`${PIPELINE_URL}/api/enterprise/rca/${currentInc.incident_id}`, { cache: 'no-store' });
        if (rcaRes.ok) {
          const rcaData = await rcaRes.json();
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
  // Coordinated "Reset to Nominal" Handler
  // - Clear chaos on Port 4001 (POST /api/chaos/reset)
  // - Clear incident records on Port 8000 (POST /api/incidents/clear)
  // - Reset incident state to null in React
  // =========================================================================
  const handleResetToNominal = async () => {
    // 1. Clear chaos on Port 4001 and incidents on Port 8000
    try {
      await Promise.allSettled([
        fetch(`${PIPELINE_URL}/api/chaos/reset`, { method: 'POST' }),
        fetch(`${AGENT_URL}/api/incidents/clear`, { method: 'POST' })
      ]);
    } catch (err) {
      console.warn('[Reset] Coordinated reset error:', err);
    }

    setIsClusterDegraded(false);
    setWorkerHealth(prev => prev ? {
      ...prev,
      status: 'healthy',
      workerPool: prev.workerPool ? {
        ...prev.workerPool,
        activeWorkers: 4
      } : undefined,
      chaosState: {
        scenario: 'NONE',
        activeIncidentId: null
      }
    } : null);

    // 2. Reset incident state to null in React
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
      await fetch(`${AGENT_URL}/api/incident/${currentInc.incident_id}/resume`, {
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
                    <span className={`text-[11px] font-mono font-bold tracking-widest uppercase px-2.5 py-0.5 rounded border ${
                      isClusterDegraded
                        ? 'text-amber-400 bg-amber-950/60 border-amber-500/30'
                        : 'text-emerald-400 bg-emerald-950/60 border-emerald-500/30'
                    }`}>
                      {isClusterDegraded ? 'SYSTEM STATUS: CLUSTER DEGRADED' : 'SYSTEM STATUS: NOMINAL'}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${
                      isClusterDegraded ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      <span className={`w-2 h-2 rounded-full inline-block ${
                        isClusterDegraded ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-ping'
                      }`} />
                      Live Monitoring
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold text-white tracking-tight mt-1.5">
                    {isClusterDegraded
                      ? `CLUSTER DEGRADED (${workerHealth?.workerPool?.activeWorkers ?? 1}/${workerHealth?.workerPool?.totalCapacity ?? 16} Workers Online)`
                      : 'ALL SYSTEMS NOMINAL (0 Active Incidents)'}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                    {isClusterDegraded
                      ? `Transcoding worker pod degradation detected on ${workerHealth?.workerPool?.cluster || 'gke-us-central1-cinema-render'} (${workerHealth?.workerPool?.nodeGroup || 'n2-highmem-16'}). Active scenario: ${workerHealth?.chaosState?.scenario || 'CORRUPTED_STREAM'}. Autonomous self-healing armed.`
                      : 'CutGuard AI autonomous SRE agent is actively monitoring cluster telemetry streams (Grafana Loki & OpenTelemetry). Transcoding worker pods are running within normal memory and bitrate parameters.'}
                  </p>
                </div>
              </div>

              {/* Direct Navigation to Platform Visualizer */}
              <div className="flex flex-col items-start md:items-end gap-2">
                <a
                  href={`${PIPELINE_URL}/player`}
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
                <div className={`text-sm font-bold font-mono mt-0.5 ${isClusterDegraded ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {isClusterDegraded ? '88 chunks/min (Degraded)' : '1,420 chunks/min'}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {isClusterDegraded 
                    ? `Worker Pool: ${workerHealth?.workerPool?.activeWorkers ?? 1}/${workerHealth?.workerPool?.totalCapacity ?? 16} Active` 
                    : `100% Target Met (${workerHealth?.workerPool?.activeWorkers ?? 4}/${workerHealth?.workerPool?.totalCapacity ?? 16} Pods)`}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                <span className="text-[10px] font-mono uppercase text-slate-400">P99 Encoding Latency</span>
                <div className={`text-sm font-bold font-mono mt-0.5 ${isClusterDegraded ? 'text-rose-400' : 'text-cyan-400'}`}>
                  {isClusterDegraded ? '842.1 ms (Spiking)' : '18.4 ms'}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {isClusterDegraded ? 'SLA Breached (> 50ms)' : 'SLA Threshold: < 50ms'}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                <span className="text-[10px] font-mono uppercase text-slate-400">Loki Error Rate</span>
                <div className={`text-sm font-bold font-mono mt-0.5 ${isClusterDegraded ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {isClusterDegraded ? '14.20 err/sec' : '0.00 err/sec'}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {isClusterDegraded ? `Exceptions: ${workerHealth?.chaosState?.scenario || 'ERR_TRANSCODE'}` : 'Clean Telemetry Window'}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                <span className="text-[10px] font-mono uppercase text-slate-400">Autonomous Guardrail</span>
                <div className="text-sm font-bold font-mono text-purple-400 mt-0.5">
                  {isClusterDegraded ? 'Self-Healing Armed' : 'Active Sandbox Ready'}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {workerHealth?.workerPool?.cluster || 'GKE Cinema Cluster'}
                </div>
              </div>
            </div>

            {/* Health & Cluster Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              <div className={`p-4 rounded-lg bg-slate-950/60 border space-y-1.5 transition-colors ${
                isClusterDegraded ? 'border-amber-500/40 bg-amber-950/10' : 'border-slate-800'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-indigo-400" />
                    Transcoder Worker
                  </span>
                  <div className="flex items-center gap-2">
                    {isClusterDegraded && pipelineOnline && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {workerHealth?.status === 'degraded' ? 'DEGRADED' : 'CRASHED'}
                      </span>
                    )}
                    <span className={`w-2 h-2 rounded-full ${pipelineOnline ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-rose-500'}`} />
                  </div>
                </div>
                <div className="text-base font-bold font-mono text-white">
                  {pipelineOnline ? 'Port 4001 ONLINE' : 'OFFLINE'}
                </div>
                <div className="text-[11px] font-mono">
                  {pipelineOnline ? (
                    isClusterDegraded ? (
                      <span className="text-amber-400 font-medium">
                        Worker Corrupted • Pool {workerHealth?.workerPool?.activeWorkers ?? 1}/{workerHealth?.workerPool?.totalCapacity ?? 16} ({workerHealth?.chaosState?.scenario || 'DEGRADED'})
                      </span>
                    ) : (
                      <span className="text-slate-400">
                        ffmpeg-transcoder pool: {workerHealth?.workerPool?.activeWorkers ?? 4}/{workerHealth?.workerPool?.totalCapacity ?? 16}
                      </span>
                    )
                  ) : (
                    <span className="text-slate-500">Connection refused</span>
                  )}
                </div>
                {workerHealth?.ffmpegVersion && (
                  <div className="text-[10px] text-slate-500 font-mono truncate" title={workerHealth.ffmpegVersion}>
                    {workerHealth.ffmpegVersion.split(' ')[0]} {workerHealth.ffmpegVersion.split(' ')[2] || ''} • {workerHealth.workerPool?.nodeGroup || 'n2-highmem-16'}
                  </div>
                )}
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
                  <span className="text-[10px] font-mono text-emerald-400">
                    {workerHealth?.workerPool?.cluster || 'gke-us-central1-cinema-render'}
                  </span>
                </div>
                <div className="space-y-2 font-mono text-slate-400">
                  <div className="flex justify-between">
                    <span>Worker Node:</span>
                    <span className="text-slate-200 truncate">
                      {workerHealth?.workerPool?.nodeGroup ? `${workerHealth.workerPool.nodeGroup}-pod` : 'n2-highmem-16-pod'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Worker Pool:</span>
                    <span className={isClusterDegraded ? "text-amber-400 font-semibold" : "text-emerald-400 font-semibold"}>
                      {isClusterDegraded 
                        ? `Degraded (${workerHealth?.workerPool?.activeWorkers ?? 1}/${workerHealth?.workerPool?.totalCapacity ?? 16} Active)` 
                        : `Nominal (${workerHealth?.workerPool?.activeWorkers ?? 4}/${workerHealth?.workerPool?.totalCapacity ?? 16} Active)`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Scenario:</span>
                    <span className="text-rose-400 font-semibold truncate max-w-[180px]" title={workerHealth?.chaosState?.scenario || 'NONE'}>
                      {workerHealth?.chaosState?.scenario || (incident?.culprit_file ? 'UNSUPPORTED_PIXEL_FORMAT' : 'NOMINAL')}
                    </span>
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
                      {pipelineOnline ? `Port 4001 (${workerHealth?.uptimeSeconds ? `${workerHealth.uptimeSeconds}s up` : 'Live'})` : 'Simulation Mode'}
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
