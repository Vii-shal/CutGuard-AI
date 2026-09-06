'use client';

import React from 'react';
import { ShieldAlert, AlertOctagon, Network, CheckCircle, Flame, Layers } from 'lucide-react';

interface BlastRadiusRadarProps {
  score: number;
  details?: {
    threat_level?: string;
    culprit_file?: string;
    affected_files?: Array<{ file: string; lines_of_code: number; symbols_imported: string[] }>;
    affected_symbols?: string[];
    affected_endpoints?: string[];
    blast_description?: string;
  };
}

export const BlastRadiusRadar: React.FC<BlastRadiusRadarProps> = ({ score, details }) => {
  const threatLevel = details?.threat_level || (score >= 80 ? 'CRITICAL' : score >= 50 ? 'HIGH' : score >= 25 ? 'MEDIUM' : 'LOW');

  const getScoreColor = () => {
    if (score >= 80) return 'text-rose-500 border-rose-500/30 bg-rose-500/10';
    if (score >= 50) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    if (score >= 25) return 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10';
    return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
  };

  const getGaugeStroke = () => {
    if (score >= 80) return '#ef4444';
    if (score >= 50) return '#f59e0b';
    if (score >= 25) return '#06b6d4';
    return '#10b981';
  };

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-cyan-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Blast Radius AST Analyzer
            </h2>
          </div>
          <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold border uppercase tracking-wider ${getScoreColor()}`}>
            {threatLevel} THREAT
          </span>
        </div>

        {/* Circular Radar / Score Display */}
        <div className="flex items-center justify-center my-3">
          <div className="relative flex items-center justify-center">
            <svg className="w-32 h-32 transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r={radius}
                stroke="#1e293b"
                strokeWidth="8"
                fill="transparent"
              />
              <circle
                cx="64"
                cy="64"
                r={radius}
                stroke={getGaugeStroke()}
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-black font-mono tracking-tight text-white">
                {score}
              </span>
              <span className="text-[10px] uppercase font-bold text-slate-400">
                / 100 Impact
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-slate-400 text-center px-2 mb-4 leading-relaxed">
          {details?.blast_description || "Calculated via deterministic static call-graph inspection of imported pipeline modules."}
        </p>

        {/* Affected Services List */}
        <div className="space-y-2 mt-4">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            Cascading Downstream Consumers
          </span>
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {details?.affected_files && details.affected_files.length > 0 ? (
              details.affected_files.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800 text-xs font-mono"
                >
                  <div className="flex items-center space-x-2 text-slate-300 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                    <span className="truncate">{item.file}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-sans px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                    {item.lines_of_code} LOC
                  </span>
                </div>
              ))
            ) : (
              <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/80 text-xs text-slate-500 font-mono text-center">
                mock-pipeline/queue-manager.js & stream-stitcher.js
              </div>
            )}
          </div>
        </div>

        {/* Affected Endpoints */}
        <div className="space-y-1.5 mt-4 pt-3 border-t border-slate-800/80">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
            <Network className="w-3.5 h-3.5 text-cyan-400" />
            Protected Video Chunk Interfaces
          </span>
          <div className="text-[11px] font-mono text-slate-400 space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-cyan-400 font-bold">›</span>
              <span className="text-slate-300 font-semibold">POST /transcode</span>
              <span className="text-slate-500">(Ingress Chunker)</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-cyan-400 font-bold">›</span>
              <span className="text-slate-300 font-semibold">StreamStitcher.stitchStream</span>
              <span className="text-slate-500">(HLS Master)</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
