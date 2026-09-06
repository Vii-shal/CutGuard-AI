'use client';

import React from 'react';
import { Film, ShieldAlert, Cpu, Activity, Play, CheckCircle2, AlertTriangle, Server, Radio } from 'lucide-react';

interface HeaderProps {
  onSimulateCrash: (scenario: string) => void;
  isSimulating: boolean;
  activeStatus: string;
  pipelineOnline: boolean;
  agentOnline: boolean;
  selectedScenario: string;
  onSelectScenario: (scen: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onSimulateCrash,
  isSimulating,
  activeStatus,
  pipelineOnline,
  agentOnline,
  selectedScenario,
  onSelectScenario
}) => {
  return (
    <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40 px-6 py-4">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Left: Branding & Tagline */}
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 shadow-lg shadow-cyan-500/20 ring-1 ring-white/20">
            <Film className="w-6 h-6 text-white" />
            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-950 animate-pulse" />
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
              Autonomous Incident Triage & Self-Healing for Media Transcoding
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

        {/* Right: Chaos Scenario Selector & Trigger */}
        <div className="flex items-center space-x-2">
          <select
            value={selectedScenario}
            onChange={(e) => onSelectScenario(e.target.value)}
            disabled={isSimulating || activeStatus === 'ANALYZING' || activeStatus === 'SANDBOXED'}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs font-mono text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="FFMPEG_OOM">Scenario: Bitrate OOM SIGABRT 137</option>
            <option value="UNSUPPORTED_PIXEL_FORMAT">Scenario: Pixel Format SIGSEGV 139</option>
            <option value="SEGMENT_CORRUPTION">Scenario: Muxer Segment Corruption</option>
          </select>

          <button
            onClick={() => onSimulateCrash(selectedScenario)}
            disabled={isSimulating || activeStatus === 'ANALYZING' || activeStatus === 'SANDBOXED'}
            className={`px-4 py-2 rounded-lg font-semibold text-xs tracking-wide uppercase transition-all duration-200 flex items-center space-x-2 shadow-lg ${
              isSimulating
                ? 'bg-amber-600/50 text-amber-200 border border-amber-500/30 cursor-not-allowed'
                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/25 hover:shadow-rose-600/40 border border-rose-400/30 active:scale-95'
            }`}
          >
            <Play className={`w-3.5 h-3.5 fill-current ${isSimulating ? 'animate-spin' : ''}`} />
            <span>{isSimulating ? 'Simulating...' : 'Simulate Crash'}</span>
          </button>
        </div>

      </div>
    </header>
  );
};
