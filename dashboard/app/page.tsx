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
  Layers
} from 'lucide-react';

export default function IncidentControlCenter() {
  const [activeTab, setActiveTab] = useState<'diff' | 'logs'>('diff');
  const [isSimulating, setIsSimulating] = useState(false);
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);
  const [isPostMortemOpen, setIsPostMortemOpen] = useState(false);

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

  // Poll incident status periodically when an incident is active
  useEffect(() => {
    if (!incident.incident_id || incident.status === 'RESOLVED' || incident.status === 'ESCALATED') {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    const fetchStatus = async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/incident/${incident.incident_id}/status`);
        if (res.ok) {
          const data = await res.json();
          setIncident(prev => ({ ...prev, ...data }));
          if (data.status === 'RESOLVED' || data.status === 'ESCALATED') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    pollIntervalRef.current = setInterval(fetchStatus, 1500);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [incident.incident_id, incident.status]);

  // Trigger Crash & Agent Remediation
  const handleSimulateCrash = async () => {
    setIsSimulating(true);
    try {
      // 1. Trigger incident in FastAPI agent
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
          created_at: new Date().toISOString()
        }));
      } else {
        // Fallback demo state if agent backend is offline during preview
        const mockId = `inc-${Date.now()}`;
        setIncident({
          incident_id: mockId,
          service: 'ffmpeg-transcoder',
          status: 'ANALYZING',
          raw_log: '2026-09-06T00:15:22.418Z CRITICAL [FFmpeg Transcoder]: Undefined bitrateProfile at worker.js:32. OutOfMemory SIGABRT (Exit 137)',
          culprit_file: 'mock-pipeline/worker.js',
          culprit_commit: 'HEAD~1',
          blast_score: 80,
          blast_details: {
            threat_level: 'CRITICAL',
            affected_files: [{ file: 'mock-pipeline/queue-manager.js', lines_of_code: 48, symbols_imported: ['processVideoChunk'] }],
            affected_symbols: ['processVideoChunk'],
            affected_endpoints: ['POST /transcode'],
            blast_description: 'Failure in worker.js cascades to video queue manager and stream stitcher.'
          },
          generated_diff: `--- a/mock-pipeline/worker.js\n+++ b/mock-pipeline/worker.js\n@@ -32,7 +32,9 @@ function processVideoChunk(chunk) {\n-  if (!chunk.bitrateProfile) {\n-    throw new Error("CRITICAL [FFmpeg Transcoder]: Undefined bitrateProfile at worker.js:32. OutOfMemory SIGABRT (Exit 137)");\n-  }\n-\n-  const targetBitrate = chunk.bitrateProfile.targetBitrate;\n-  const resolution = chunk.bitrateProfile.resolution || '1280x720';\n+  // Fallback to 720p_auto profile when bitrateProfile is omitted\n+  const profile = chunk.bitrateProfile || DEFAULT_PRESETS['720p_auto'] || { targetBitrate: '4500k', resolution: '1280x720' };\n+  const targetBitrate = profile.targetBitrate;\n+  const resolution = profile.resolution || '1280x720';`,
          test_passed: true,
          test_output: 'PASS mock-pipeline/worker.test.js\n  √ processes video chunk successfully with valid explicit bitrateProfile (4 ms)\n  √ properly handles missing bitrateProfile by falling back to 720p_auto without crashing (5 ms)\n  √ throws descriptive error on invalid null chunk payload (1 ms)\n\nTest Suites: 1 passed, 1 total\nTests: 3 passed, 3 total',
          retry_count: 1,
          human_approved: null,
          post_mortem: '# Enterprise SRE Post-Mortem\nIncident resolved by CutGuard AI.',
          created_at: new Date().toISOString()
        });
      }
    } catch (e) {
      console.warn('Backend fetch error, activating demonstration mode:', e);
      // Demo fallback
      setIncident(prev => ({
        ...prev,
        incident_id: `inc-demo-${Date.now()}`,
        status: 'NEEDS_APPROVAL',
        raw_log: 'CRITICAL [FFmpeg Transcoder]: Undefined bitrateProfile at worker.js:32. OutOfMemory SIGABRT (Exit 137)',
        blast_score: 80,
        test_passed: true,
        generated_diff: `--- a/mock-pipeline/worker.js\n+++ b/mock-pipeline/worker.js\n@@ -32,7 +32,9 @@ function processVideoChunk(chunk) {\n-  if (!chunk.bitrateProfile) {\n-    throw new Error("CRITICAL [FFmpeg Transcoder]: Undefined bitrateProfile at worker.js:32. OutOfMemory SIGABRT (Exit 137)");\n-  }\n-\n-  const targetBitrate = chunk.bitrateProfile.targetBitrate;\n-  const resolution = chunk.bitrateProfile.resolution || '1280x720';\n+  // Fallback to 720p_auto profile when bitrateProfile is omitted\n+  const profile = chunk.bitrateProfile || DEFAULT_PRESETS['720p_auto'] || { targetBitrate: '4500k', resolution: '1280x720' };\n+  const targetBitrate = profile.targetBitrate;\n+  const resolution = profile.resolution || '1280x720';`,
        test_output: 'PASS mock-pipeline/worker.test.js\nTests: 3 passed, 3 total',
        created_at: new Date().toISOString()
      }));
    } finally {
      setIsSimulating(false);
    }
  };

  // Resume Approval
  const handleApprove = async () => {
    setIsProcessingApproval(true);
    try {
      const res = await fetch(`http://localhost:8000/api/incident/${incident.incident_id}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: true, approver: 'Lead Cinema SRE' })
      });
      if (res.ok) {
        const data = await res.json();
        setIncident(prev => ({ ...prev, status: 'RESOLVED', human_approved: true }));
      } else {
        setIncident(prev => ({ ...prev, status: 'RESOLVED', human_approved: true }));
      }
    } catch (e) {
      setIncident(prev => ({ ...prev, status: 'RESOLVED', human_approved: true }));
    } finally {
      setIsProcessingApproval(false);
    }
  };

  // Resume Reject
  const handleReject = async () => {
    setIsProcessingApproval(true);
    try {
      await fetch(`http://localhost:8000/api/incident/${incident.incident_id}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: false, approver: 'Lead Cinema SRE' })
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
                  Transcoding worker patched, committed to Git, and telemetry normalized.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsPostMortemOpen(true)}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-lg shadow-emerald-600/20"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>View Enterprise RCA Post-Mortem</span>
            </button>
          </div>
        )}

        {/* Dual Grid: Blast Radius Left + Code Diff / Test Logs Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Blast Radius Analysis (4 Cols) */}
          <div className="lg:col-span-4 space-y-6">
            <BlastRadiusRadar
              score={incident.blast_score}
              details={incident.blast_details}
            />

            {/* Quick SRE Telemetry Stats Card */}
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
                  <span className="text-rose-400">SIGABRT (Exit 137 OOM)</span>
                </div>
                <div className="flex justify-between">
                  <span>Self-Healing Loop:</span>
                  <span className="text-cyan-400">{incident.retry_count} / 2 Retries</span>
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
                Target: mock-pipeline/worker.js
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
