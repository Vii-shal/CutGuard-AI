'use client';

import React from 'react';
import { Film, ShieldAlert, Cpu, Activity, Play, CheckCircle2, AlertTriangle } from 'lucide-react';

interface HeaderProps {
  onSimulateCrash: () => void;
  isSimulating: boolean;
  activeStatus: string;
}

export const Header: React.FC<HeaderProps> = ({ onSimulateCrash, isSimulating, activeStatus }) => {
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

        {/* Center: Track & Technology Badges */}
        <div className="hidden lg:flex items-center space-x-2 bg-slate-950/80 px-3.5 py-1.5 rounded-lg border border-slate-800 text-xs">
          <div className="flex items-center space-x-1.5 text-orange-400">
            <Activity className="w-3.5 h-3.5" />
            <span className="font-semibold text-slate-200">Grafana MCP</span>
            <span className="text-[10px] text-orange-400/80 font-mono">@grafana/mcp</span>
          </div>
          <span className="text-slate-600">|</span>
          <div className="flex items-center space-x-1.5 text-cyan-400">
            <Cpu className="w-3.5 h-3.5" />
            <span className="font-semibold text-slate-200">Google Gemini</span>
            <span className="text-[10px] text-cyan-400/80 font-mono">2.5 Flash / Pro</span>
          </div>
          <span className="text-slate-600">|</span>
          <div className="flex items-center space-x-1.5 text-emerald-400">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span className="font-semibold text-slate-200">LangGraph</span>
            <span className="text-[10px] text-emerald-400/80 font-mono">Cyclic HITL</span>
          </div>
        </div>

        {/* Right: Simulation Action Trigger */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onSimulateCrash}
            disabled={isSimulating || activeStatus === 'ANALYZING' || activeStatus === 'SANDBOXED'}
            className={`px-4 py-2.5 rounded-lg font-semibold text-xs tracking-wide uppercase transition-all duration-200 flex items-center space-x-2 shadow-lg ${
              isSimulating
                ? 'bg-amber-600/50 text-amber-200 border border-amber-500/30 cursor-not-allowed'
                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/25 hover:shadow-rose-600/40 border border-rose-400/30 active:scale-95'
            }`}
          >
            <Play className={`w-3.5 h-3.5 fill-current ${isSimulating ? 'animate-spin' : ''}`} />
            <span>{isSimulating ? 'Simulating Transcode OOM...' : 'Simulate Pipeline Crash'}</span>
          </button>
        </div>

      </div>
    </header>
  );
};
