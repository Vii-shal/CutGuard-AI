'use client';

import React from 'react';
import { Film, Cpu, Activity, Server, ShieldCheck, ExternalLink } from 'lucide-react';

interface HeaderProps {
  onSimulateCrash?: (scenario: string) => void;
  isSimulating?: boolean;
  activeStatus: string;
  pipelineOnline: boolean;
  agentOnline: boolean;
  selectedScenario?: string;
  onSelectScenario?: (scen: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeStatus,
  pipelineOnline,
  agentOnline,
  onSimulateCrash,
  isSimulating,
  selectedScenario
}) => {
  const isSyncing = activeStatus === 'SYNCING' || activeStatus === 'INITIALIZING';
  const isNominal = (activeStatus === 'IDLE' || activeStatus === 'RESOLVED') && !isSyncing;
  const needsApproval = activeStatus === 'NEEDS_APPROVAL';

  return (
    <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40 px-6 py-4">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Left: Branding & Tagline */}
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 shadow-lg shadow-cyan-500/20 ring-1 ring-white/20">
            <Film className="w-6 h-6 text-white" />
            <div className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-950 ${isNominal ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500 animate-ping'}`} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
                CUTGUARD <span className="bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">AI</span>
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Agentic Cinema SRE
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Mission Control • Passive Incident Observability & Autonomous Remediation
            </p>
          </div>
        </div>

        {/* Center: Live Infrastructure Connectivity */}
        <div className="flex items-center space-x-3 bg-slate-950/90 px-4 py-2 rounded-xl border border-slate-800 text-xs">
          {/* Media Worker Port 4001 */}
          <div className="flex items-center space-x-2">
            <Server className={`w-3.5 h-3.5 ${pipelineOnline ? 'text-emerald-400' : 'text-rose-400'}`} />
            <span className="text-slate-300 font-mono text-[11px]">Worker :4001</span>
            <span className={`w-2 h-2 rounded-full ${pipelineOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
          </div>

          <span className="text-slate-700">|</span>

          {/* SRE Agent Port 8000 */}
          <div className="flex items-center space-x-2">
            <Cpu className={`w-3.5 h-3.5 ${agentOnline ? 'text-cyan-400' : 'text-rose-400'}`} />
            <span className="text-slate-300 font-mono text-[11px]">SRE Agent :8000</span>
            <span className={`w-2 h-2 rounded-full ${agentOnline ? 'bg-cyan-400 animate-pulse' : 'bg-rose-500'}`} />
          </div>

          <span className="text-slate-700">|</span>

          <div className="flex items-center space-x-1.5 text-orange-400 text-[11px]">
            <Activity className="w-3.5 h-3.5" />
            <span className="font-mono text-slate-300">Grafana Loki</span>
          </div>
        </div>

        {/* Right: Passive Status Indicator & Link to Transcoder Player */}
        <div className="flex items-center space-x-3">
          <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all ${
            isSyncing
              ? 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300'
              : isNominal
              ? 'bg-emerald-950/50 border-emerald-500/30 text-emerald-300'
              : needsApproval
              ? 'bg-amber-950/60 border-amber-500/40 text-amber-300 animate-pulse'
              : 'bg-rose-950/60 border-rose-500/40 text-rose-300 animate-pulse'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              isSyncing ? 'bg-cyan-400 animate-ping' : isNominal ? 'bg-emerald-400 animate-pulse' : needsApproval ? 'bg-amber-400 animate-ping' : 'bg-rose-400 animate-ping'
            }`} />
            <span>
              {isSyncing ? 'SYNCING TELEMETRY...' : activeStatus === 'IDLE' ? 'PASSIVE OBSERVABILITY: ARMED' : activeStatus.replace('_', ' ')}
            </span>
          </div>

          {onSimulateCrash && isNominal && (
            <button
              onClick={() => onSimulateCrash(selectedScenario || 'UNSUPPORTED_PIXEL_FORMAT')}
              disabled={isSimulating}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-600/20 flex items-center space-x-1.5 active:scale-95 disabled:opacity-50"
              title="Simulate Corrupt Stream Payload on Worker"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>{isSimulating ? 'Injecting...' : 'Simulate Fault'}</span>
            </button>
          )}

          <a
            href="http://localhost:4001/player"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/25 flex items-center space-x-1.5 active:scale-95"
            title="Open Interactive Video Transcoding Visualizer on Port 4001"
          >
            <span>Stream Player (:4001)</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

      </div>
    </header>
  );
};
