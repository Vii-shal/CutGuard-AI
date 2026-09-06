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
  const [isSimulating, setIsSimulating] = useState(false);
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);
  const [isPostMortemOpen, setIsPostMortemOpen] = useState(false);

  // Live Infrastructure Connectivity
  const [pipelineOnline, setPipelineOnline] = useState<boolean>(false);
  const [agentOnline, setAgentOnline] = useState<boolean>(false);
  const [selectedScenario, setSelectedScenario] = useState<string>('FFMPEG_OOM');

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

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Poll incident status periodically from FastAPI Agent when an incident is active
  useEffect(() => {
    if (!incident.incident_id || incident.status === 'RESOLVED' || incident.status === 'ESCALATED') {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    const fetchStatus = async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/incident/${incident.incident_id}/status`, {
          cache: 'no-store'
        });
        if (res.ok) {
          const data = await res.json();
          setIncident(prev => ({
            ...prev,
            ...data,
            blast_details: data.blast_details || prev.blast_details
          }));
          if (data.status === 'RESOLVED' || data.status === 'ESCALATED') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          }
        }
      } catch (err) {
        console.error('Incident polling error:', err);
      }
    };

    pollIntervalRef.current = setInterval(fetchStatus, 1500);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [incident.incident_id, incident.status]);

  // Reset console to nominal idle state
  const handleResetToNominal = async () => {
    try {
      await fetch('http://localhost:4001/api/chaos/reset', { method: 'POST' });
    } catch (err) {
      console.warn('Chaos reset notice:', err);
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

  // Trigger Crash & Agent Remediation Cycle
  const handleSimulateCrash = async (scenario: string = selectedScenario) => {
    setIsSimulating(true);
    const targetFile = scenario === 'FFMPEG_OOM' ? 'mock-pipeline/worker.js' : 'src/transcoder/ffmpegArgs.ts';

    // Reset view to fresh analyzing state
    setIncident({
      incident_id: '',
      service: 'ffmpeg-transcoder',
      status: 'ANALYZING',
      raw_log: 'Injecting chaos scenario and polling telemetry stream...',
      culprit_file: targetFile,
      culprit_commit: 'HEAD~1',
      blast_score: 0,
      blast_details: {},
      generated_diff: '',
      test_passed: false,
      test_output: '',
      retry_count: 0,
      human_approved: null,
      post_mortem: '',
      created_at: new Date().toISOString()
    });

    try {
      // Step 1: Prime the media worker with chaos injection on port 4001
      try {
        await fetch('http://localhost:4001/api/chaos/inject', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scenario })
        });
      } catch (err) {
        console.warn('Mock worker chaos injection notice (worker may be offline):', err);
      }

      // Step 2: Trigger incident remediation on SRE agent (FastAPI port 8000)
      const res = await fetch('http://localhost:8000/api/incident/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_name: 'ffmpeg-transcoder' })
      });

      if (res.ok) {
        const data = await res.json();
        setIncident(prev => ({
          ...prev,
          incident_id: data.incident_id,
          status: 'ANALYZING',
          raw_log: `Telemetry intercepted from Grafana Loki. SRE Agent LangGraph dispatched (ID: ${data.incident_id}).`
        }));
      } else {
        setIncident(prev => ({
          ...prev,
          status: 'ESCALATED',
          raw_log: 'Failed to dispatch LangGraph SRE agent. Please ensure SRE Agent (:8000) is running.'
        }));
      }
    } catch (e) {
      console.error('Error connecting to SRE Agent:', e);
      setIncident(prev => ({
        ...prev,
        status: 'ESCALATED',
        raw_log: `Connection error: SRE Agent (:8000) unreachable (${e instanceof Error ? e.message : String(e)}). Please verify the agent server is running.`
      }));
    } finally {
      setIsSimulating(false);
    }
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
        onSimulateCrash={handleSimulateCrash}
        isSimulating={isSimulating}
        activeStatus={incident.status}
        pipelineOnline={pipelineOnline}
        agentOnline={agentOnline}
        selectedScenario={selectedScenario}
        onSelectScenario={setSelectedScenario}
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

              <button
                onClick={() => handleSimulateCrash(selectedScenario)}
                disabled={isSimulating}
                className="px-5 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-xs flex items-center space-x-2 shadow-xl shadow-rose-950/60 border border-rose-400/40 transition-all duration-200 active:scale-95 disabled:opacity-50 whitespace-nowrap"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Simulate Pipeline Crash</span>
              </button>
            </div>

            {/* Health & Cluster Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
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
                  {agentOnline ? 'Gemini 2.5 + HITL Gate' : 'FastAPI unavailable'}
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
                    ) : selectedScenario === 'UNSUPPORTED_PIXEL_FORMAT' ? (
                      <span className="text-rose-400 font-semibold">SIGSEGV (Exit 139)</span>
                    ) : selectedScenario === 'FFMPEG_OOM' ? (
                      <span className="text-rose-400 font-semibold">SIGABRT (Exit 137 OOM)</span>
                    ) : (
                      <span className="text-rose-400 font-semibold">SIGTERM (Exit 1)</span>
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
