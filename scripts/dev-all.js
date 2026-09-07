#!/usr/bin/env node
/**
 * CutGuard AI — Unified Multi-Tier Orchestrator
 * Spawns and supervises all 3 tiers with formatted output and graceful shutdown:
 *   1. Mock Media Pipeline Worker (Port 4001)
 *   2. Python FastAPI SRE Agent & LangGraph API (Port 8000)
 *   3. Next.js Incident Control Center Dashboard (Port 3000)
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

// Terminal colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

const ROOT_DIR = path.resolve(__dirname, '..');
const PIPELINE_DIR = path.join(ROOT_DIR, 'mock-pipeline');
const AGENT_DIR = path.join(ROOT_DIR, 'sre-agent');
const DASHBOARD_DIR = path.join(ROOT_DIR, 'dashboard');

// Resolve Python executable
function resolvePython() {
  if (process.env.PYTHON) return process.env.PYTHON;

  const candidates = [
    path.join(AGENT_DIR, '.venv', 'Scripts', 'python.exe'),
    path.join(AGENT_DIR, '.venv', 'bin', 'python'),
    path.join(AGENT_DIR, 'venv', 'Scripts', 'python.exe'),
    path.join(AGENT_DIR, 'venv', 'bin', 'python'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Fallback to system python
  return process.platform === 'win32' ? 'python' : 'python3';
}

const pythonBin = resolvePython();

// Banner
console.log(`
${colors.bright}${colors.cyan}================================================================${colors.reset}
${colors.bright}${colors.cyan}        CUTGUARD AI — UNIFIED SYSTEM ORCHESTRATOR (DX)          ${colors.reset}
${colors.bright}${colors.cyan}================================================================${colors.reset}
${colors.green}  ✓${colors.reset} ${colors.bright}Media Worker Pipeline:${colors.reset}   http://localhost:4001
${colors.green}  ✓${colors.reset} ${colors.bright}FastAPI SRE Agent:${colors.reset}       http://localhost:8000
${colors.green}  ✓${colors.reset} ${colors.bright}Mission Control Console:${colors.reset} http://localhost:3000
${colors.dim}  Press Ctrl+C to gracefully terminate all services${colors.reset}
${colors.cyan}----------------------------------------------------------------${colors.reset}
`);

const services = [
  {
    name: 'pipeline',
    label: '[worker:4001] ',
    color: colors.cyan,
    cmd: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['run', 'dev'],
    cwd: PIPELINE_DIR,
    proc: null,
  },
  {
    name: 'agent',
    label: '[sre-agent]   ',
    color: colors.magenta,
    cmd: pythonBin,
    args: ['server.py'],
    cwd: AGENT_DIR,
    proc: null,
  },
  {
    name: 'dashboard',
    label: '[dashboard]   ',
    color: colors.blue,
    cmd: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['run', 'dev'],
    cwd: DASHBOARD_DIR,
    proc: null,
  },
];

let isShuttingDown = false;

function prefixStream(stream, label, color) {
  if (!stream) return;
  let buffer = '';
  stream.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (line.trim().length > 0) {
        console.log(`${color}${label}${colors.reset}${line}`);
      }
    }
  });
  stream.on('end', () => {
    if (buffer.trim().length > 0) {
      console.log(`${color}${label}${colors.reset}${buffer}`);
    }
  });
}

function startService(svc) {
  try {
    const child = spawn(svc.cmd, svc.args, {
      cwd: svc.cwd,
      env: { ...process.env, FORCE_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });

    svc.proc = child;
    prefixStream(child.stdout, svc.label, svc.color);
    prefixStream(child.stderr, svc.label, svc.color);

    child.on('error', (err) => {
      console.error(`${colors.red}${svc.label}[ERROR] Failed to start: ${err.message}${colors.reset}`);
    });

    child.on('close', (code, signal) => {
      if (!isShuttingDown) {
        console.log(
          `${svc.color}${svc.label}${colors.reset}Process exited with code ${code || 0}${
            signal ? ` (signal ${signal})` : ''
          }`
        );
      }
    });
  } catch (err) {
    console.error(`${colors.red}${svc.label}[FATAL] Could not spawn: ${err.message}${colors.reset}`);
  }
}

// Kill process tree cleanly
function killService(svc) {
  if (!svc.proc || !svc.proc.pid) return;
  const pid = svc.proc.pid;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGTERM');
    }
  } catch (e) {
    try {
      svc.proc.kill('SIGTERM');
    } catch (e2) {}
  }
}

function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n${colors.yellow}[CutGuard AI] Shutting down all multi-tier services...${colors.reset}`);
  for (const svc of services) {
    killService(svc);
  }
  setTimeout(() => {
    console.log(`${colors.green}[CutGuard AI] All services stopped cleanly. Goodbye!${colors.reset}`);
    process.exit(0);
  }, 1000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

if (process.platform === 'win32') {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.on('SIGINT', () => {
    shutdown();
  });
}

// Launch all services concurrently
for (const svc of services) {
  startService(svc);
}
