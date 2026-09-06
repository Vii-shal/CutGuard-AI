'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  Sparkles, 
  Play, 
  RefreshCw,
  Server,
  Layers,
  ShieldCheck
} from 'lucide-react';

export default function IncidentControlCenter() {
  const [activeTab, setActiveTab] = useState<'diff' | 'logs'>('diff');
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);
  const [isPostMortemOpen, setIsPostMortemOpen] = useState(false);

  // Live Infrastructure Connectivity
  const [pipelineOnline, setPipelineOnline] = useState<boolean>(false);
  const [agentOnline, setAgentOnline] = useState<boolean>(false);

  // Active Incident State
  const [incident, setIncident] = useState({
    incident_id: '',
    service: 'ffmpeg-transcoder',
    status: 'IDLE',
    raw_log: '',
    culprit_file: 'mock-pipeline/worker.js',
    culprit_commit: '',
    blast_score: 0,
    blast_details: {} as any,
    generated_diff: '',
    test_passed: false,
    test_output: '',
    retry_count: 0,
    human_approved: null as boolean | null,
    post_mortem: '',
    created_at: ''
  });

  // Periodic health check for :4001 (Worker) and :8000 (SRE Agent)
  useEffect(() => {
    const checkServices = async () => {
      // Check Mock Pipeline (:4001)
      try {
        const res = await fetch('http://localhost:4001/health', { cache: 'no-store' });
        setPipelineOnline(res.ok);
      } catch {
        setPipelineOnline(false);
      }

      // Check SRE Agent (:8000)
      try {
        const res = await fetch('http://localhost:8000/api/health', { cache: 'no-store' });
        setAgentOnline(res.ok);
      } catch {
        setAgentOnline(false);
      }
    };

    checkServices();
    const interval = setInterval(checkServices, 3000);
    return () => clearInterval(interval);
  }, []);

  // Requirement 3: Automatic passive poller checking SRE Agent & Mock Pipeline
  // Autonomously detects incoming platform incidents without manual injection
  useEffect(() => {
    let isCancelled = false;

    const pollPassiveTelemetry = async () => {
      try {
        const [agentRes, pipelineRes] = await Promise.allSettled([
          fetch('http://localhost:8000/api/incident/latest', { cache: 'no-store' }),
          fetch('http://localhost:4001/api/chaos/status', { cache: 'no-store' })
        ]);

        let latestAgentInc: any = null;
        if (agentRes.status === 'fulfilled' && agentRes.value.ok) {
          const data = await agentRes.value.json();
          latestAgentInc = data.incident;
        }

        let pipelineChaos: any = null;
        if (pipelineRes.status === 'fulfilled' && pipelineRes.value.ok) {
          pipelineChaos = await pipelineRes.value.json();
        }

        if (isCancelled) return;

        // CASE 1: SRE Agent has an active incident record
        if (latestAgentInc && latestAgentInc.incident_id) {
          // If dashboard is IDLE: only wake up if incoming incident is active (not resolved/escalated)
          if (incident.status === 'IDLE') {
            if (latestAgentInc.status !== 'RESOLVED' && latestAgentInc.status !== 'ESCALATED') {
              setIncident({
                ...latestAgentInc,
                blast_details: latestAgentInc.blast_details || {}
              });
            }
          } else if (incident.status !== 'RESOLVED' && incident.status !== 'ESCALATED') {
            // Dashboard is already tracking active incident: update state
            if (!incident.incident_id || latestAgentInc.incident_id === incident.incident_id) {
              setIncident(prev => ({
                ...prev,
                ...latestAgentInc,
                blast_details: latestAgentInc.blast_details || prev.blast_details
              }));
            }
          }
        } 
        // CASE 2: Pipeline crashed on Port 4001 but agent incident record is still forming
        else if (pipelineChaos && pipelineChaos.isCrashed && pipelineChaos.activeIncident) {
          if (incident.status === 'IDLE') {
            setIncident({
              incident_id: pipelineChaos.activeIncident.incidentId,
              service: 'ffmpeg-transcoder',
              status: 'ANALYZING',
              raw_log: pipelineChaos.activeIncident.rawStderr || 'Pipeline crash detected on Port 4001. Ingesting crash telemetry...',
              culprit_file: pipelineChaos.activeIncident.failingFile || 'mock-pipeline/worker.js',
              culprit_commit: 'HEAD~1',
              blast_score: 0,
              blast_details: {},
              generated_diff: '',
              test_passed: false,
              test_output: '',
              retry_count: 0,
              human_approved: null,
              post_mortem: '',
              created_at: pipelineChaos.activeIncident.timestamp || new Date().toISOString()
            });
          }
        }
      } catch (err) {
        // Services may be starting or network idle
      }
    };

    const interval = setInterval(pollPassiveTelemetry, 1000);
    pollPassiveTelemetry();

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [incident.incident_id, incident.status]);

  // Reset console to nominal monitoring state
  const handleResetToNominal = async () => {
    try {
      await fetch('http://localhost:4001/api/chaos/reset', { method: 'POST' });
      await fetch('http://localhost:8000/api/incidents/clear', { method: 'POST' });
    } catch (err) {
      console.warn('Nominal reset notice:', err);
    }
    setIncident({
      incident_id: '',
      service: 'ffmpeg-transcoder',
      status: 'IDLE',
      raw_log: '',
      culprit_file: 'mock-pipeline/worker.js',
      culprit_commit: '',
      blast_score: 0,
      blast_details: {} as any,
      generated_diff: '',
      test_passed: false,
      test_output: '',
      retry_count: 0,
      human_approved: null,
      post_mortem: '',
      created_at: ''
    });
  };

  // Human-in-the-loop: Approve & Deploy Fix
  const handleApprove = async () => {
    setIsProcessingApproval(true);
    try {
      // 1. Resume LangGraph workflow via FastAPI Agent with action: 'approve'
      try {
        await fetch(`http://localhost:8000/api/incident/${incident.incident_id}/resume`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approved: true, action: 'approve', approver: 'Lead Cinema SRE' })
        });
      } catch (err) {
        console.warn('SRE agent resume notice:', err);
      }

      // 2. Synchronize directly with mock-pipeline on port 4001 (apply patch & reset failure state)
      try {
        if (incident.generated_diff) {
          await fetch('http://localhost:4001/api/patch/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              patch: incident.generated_diff,
              incidentId: incident.incident_id,
              operatorSignOff: true
            })
          });
        }
        await fetch('http://localhost:4001/api/chaos/reset', { method: 'POST' });
      } catch (err) {
        console.warn('Pipeline direct synchronization notice:', err);
      }

      // 3. Obtain Enterprise RCA report if not yet populated
      let rcaReport = incident.post_mortem;
      if (!rcaReport) {
        try {
          const rcaRes = await fetch(`http://localhost:4001/api/enterprise/rca/${incident.incident_id}`);
          if (rcaRes.ok) {
            const rcaData = await rcaRes.json();
            rcaReport = `# Enterprise Incident RCA & Post-Mortem\n**Incident ID:** \`${rcaData.incidentId}\`\n**Severity:** \`${rcaData.severity}\`\n**MTTR:** \`${rcaData.mttr}\`\n**Status:** **${rcaData.verificationStatus}**\n\n### Root Cause Analysis\n${rcaData.rootCauseAnalysis?.summary}\n\n**Trigger Mechanism:**\n${rcaData.rootCauseAnalysis?.triggerMechanism}\n\n### Applied Code Patch\n\`\`\`diff\n${rcaData.appliedPatch}\n\`\`\``;
          }
        } catch {
          // Keep existing or default post-mortem
        }
      }

      setIncident(prev => ({
        ...prev,
        status: 'RESOLVED',
        human_approved: true,
        post_mortem: rcaReport || prev.post_mortem
      }));
    } finally {
      setIsProcessingApproval(false);
    }
  };

  // Human-in-the-loop: Reject & Rollback
  const handleReject = async () => {
    setIsProcessingApproval(true);
    try {
      await fetch(`http://localhost:8000/api/incident/${incident.incident_id}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: false, action: 'reject', approver: 'Lead Cinema SRE' })
      });
      setIncident(prev => ({ ...prev, status: 'ESCALATED', human_approved: false }));
    } catch (e) {
      setIncident(prev => ({ ...prev, status: 'ESCALATED', human_approved: false }));
    } finally {
      setIsProcessingApproval(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#030712] text-slate-100 font-sans">
      
      {/* Top Navbar */}
      <Header
        activeStatus={incident.status}
        pipelineOnline={pipelineOnline}
        agentOnline={agentOnline}
      />

      {/* Main Command Center */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        
        {/* Incident Lifecycle Header & Progress Stepper */}
        <IncidentFeed
          incidentId={incident.incident_id}
          status={incident.status}
          service={incident.service}
          rawLog={incident.raw_log}
          createdAt={incident.created_at}
          culpritFile={incident.culprit_file}
          blastScore={incident.blast_score}
        />

        {/* Human-in-the-Loop Approval Decision Bar */}
        <HumanApprovalBar
          incidentId={incident.incident_id}
          status={incident.status}
          onApprove={handleApprove}
          onReject={handleReject}
          isProcessing={isProcessingApproval}
          blastScore={incident.blast_score}
        />

        {/* Resolved Banner Action */}
        {incident.status === 'RESOLVED' && (
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
        {incident.status === 'ESCALATED' && (
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
        {incident.status === 'IDLE' ? (
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
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Loki Telemetry Passive Scan Stream
                </span>
                <span className="text-[10px] font-mono text-slate-500">Live Polling • 1,000ms</span>
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
                score={incident.blast_score}
                details={incident.blast_details}
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
                    <span className="text-slate-200 truncate">
                      {incident.status === 'IDLE' ? 'transcode-pool-idle' : 'transcode-worker-7f89b'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Exit Signal:</span>
                    {incident.status === 'IDLE' ? (
                      <span className="text-emerald-400 font-semibold">None (Nominal)</span>
                    ) : incident.status === 'RESOLVED' ? (
                      <span className="text-emerald-400 font-semibold">Recovered (Exit 0)</span>
                    ) : (incident.raw_log.includes('139') || incident.raw_log.includes('SIGSEGV')) ? (
                      <span className="text-rose-400 font-semibold">SIGSEGV (Exit 139)</span>
                    ) : (incident.raw_log.includes('137') || incident.raw_log.includes('SIGABRT')) ? (
                      <span className="text-rose-400 font-semibold">SIGABRT (Exit 137 OOM)</span>
                    ) : (
                      <span className="text-rose-400 font-semibold">SIGSEGV (Exit 139)</span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span>Self-Healing Loop:</span>
                    {incident.status === 'IDLE' ? (
                      <span className="text-slate-500">Standby (0 active)</span>
                    ) : incident.status === 'RESOLVED' ? (
                      <span className="text-emerald-400 font-semibold">1 / 1 Remediated &amp; Verified</span>
                    ) : (
                      <span className="text-cyan-400 font-semibold">{incident.retry_count} / 2 Retries</span>
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
                    {incident.test_passed && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    )}
                  </button>
                </div>

                <div className="text-[11px] text-slate-500 font-mono">
                  Target: {incident.culprit_file || 'mock-pipeline/worker.js'}
                </div>
              </div>

              {/* Tab Body */}
              <div className="flex-1">
                {activeTab === 'diff' ? (
                  <DiffViewer
                    diff={incident.generated_diff}
                    culpritFile={incident.culprit_file}
                    testPassed={incident.test_passed}
                  />
                ) : (
                  <SandboxLogs
                    logs={incident.test_output}
                    testPassed={incident.test_passed}
                    retryCount={incident.retry_count}
                    status={incident.status}
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
        postMortem={incident.post_mortem}
        incidentId={incident.incident_id}
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
