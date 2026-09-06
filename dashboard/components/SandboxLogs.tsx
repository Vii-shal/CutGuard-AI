'use client';

import React from 'react';
import { Terminal, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface SandboxLogsProps {
  logs: string;
  testPassed?: boolean;
  retryCount?: number;
  status?: string;
}

export const SandboxLogs: React.FC<SandboxLogsProps> = ({
  logs,
  testPassed = false,
  retryCount = 0,
  status = ''
}) => {
  const isRunning = status === 'SANDBOXED' && !logs;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col h-full">
      {/* Terminal Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950/90 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1.5 mr-2">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <Terminal className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-mono text-xs font-bold text-slate-300">
            Jest Isolated Sandbox Runner
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {isRunning ? (
            <span className="flex items-center space-x-1 text-[10px] text-amber-400 font-mono">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Executing Test Subprocess...</span>
            </span>
          ) : testPassed ? (
            <span className="flex items-center space-x-1 text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
              <CheckCircle className="w-3 h-3" />
              <span>PASSED (100% Assertions Satisfied)</span>
            </span>
          ) : logs ? (
            <span className="flex items-center space-x-1 text-[10px] text-rose-400 font-mono bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 font-bold">
              <XCircle className="w-3 h-3" />
              <span>FAILED (Retries: {retryCount}/2)</span>
            </span>
          ) : (
            <span className="text-[10px] text-slate-500 font-mono">IDLE</span>
          )}
        </div>
      </div>

      {/* Terminal Output */}
      <div className="p-4 font-mono text-xs overflow-x-auto overflow-y-auto max-h-[380px] bg-slate-950 text-slate-300 leading-relaxed space-y-1">
        {logs ? (
          logs.split('\n').map((line, idx) => {
            let textColor = 'text-slate-300';
            if (line.includes('PASS') || line.includes('passed')) textColor = 'text-emerald-400 font-semibold';
            if (line.includes('FAIL') || line.includes('failed') || line.includes('Error')) textColor = 'text-rose-400 font-semibold';
            if (line.includes('Test Suites:') || line.includes('Tests:')) textColor = 'text-cyan-300 font-bold';

            return (
              <div key={idx} className={`${textColor} whitespace-pre-wrap`}>
                {line}
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-slate-600 space-y-2">
            <Terminal className="w-8 h-8 opacity-40" />
            <p className="text-xs">No sandbox executions recorded yet.</p>
          </div>
        )}
      </div>

      {/* Terminal Footer */}
      <div className="px-4 py-2 bg-slate-950/90 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
        <span>Execution Environment: mock-pipeline/worker.test.js</span>
        <span className="font-mono text-slate-500">npm test sandbox</span>
      </div>
    </div>
  );
};
