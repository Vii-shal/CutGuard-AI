# CutGuard AI — Autonomous Video Transcoding Incident SRE Agent

> **Competition:** Agentic Cinema Hackathon (Google Cloud + Devpost)  
> **Target Partner Track:** Grafana Labs Track (via `@grafana/mcp` / `mcp-grafana`)

CutGuard AI is an autonomous, self-healing Site Reliability Engineering (SRE) agent purpose-built for cloud cinema rendering, video transcoding clusters, and streaming manifest pipelines. When distributed FFmpeg workers crash (e.g., Out-of-Memory SIGABRT caused by malformed chunk manifests or omitted bitrate profiles), CutGuard AI autonomously intercepts telemetry from Grafana Loki, computes the downstream blast radius, synthesizes a defensive code patch using Google Gemini 2.5, validates it inside an isolated Jest sandbox runner, and halts for human-in-the-loop SRE sign-off before deploying to production.

---

## Architecture Overview

```
                          ┌───────────────────────────┐
                          │   Grafana Loki Log Stream │
                          │   {app="ffmpeg-transcoder"}│
                          └─────────────┬─────────────┘
                                        │
                                        ▼
                          ┌───────────────────────────┐
                          │   Official Grafana MCP    │
                          │   (@grafana/mcp / uvx)    │
                          └─────────────┬─────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ CutGuard AI — LangGraph Cyclic State Machine                                    │
│                                                                                 │
│   [Node 1: Triage Node]                                                         │
│     • Ingests Loki telemetry & stack traces                                     │
│     • Uses Gemini 2.5 Flash to isolate culprit file (worker.js) & line 32       │
│                                                                                 │
│   [Node 2: Blast Radius Analyzer]                                               │
│     • Deterministic AST/Call-Graph dependency analysis                          │
│     • Scores risk 0–100 across dependent streaming services                     │
│                                                                                 │
│   [Node 3: Sandbox Patching & Self-Healing Loop]                                │
│     • Uses Gemini 2.5 Pro to synthesize surgical Git Unified Diff               │
│     • Executes isolated Jest test runner (`npm test`) in sandbox subprocess     │
│     • If tests fail & retry_count < 2: Loops back with error logs               │
│                                                                                 │
│   [Node 4: Human-in-the-Loop Approval Gate]                                     │
│     • Native LangGraph interrupt() halts state machine in memory checkpointer   │
│     • Displays live diff & blast score in SRE Mission Control Console           │
│                                                                                 │
│   [Node 5: Autonomous Production Deployment]                                    │
│     • Permanently applies patch, tags Git commit                                │
│     • Compiles Enterprise Markdown RCA Post-Mortem                              │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
                          ┌───────────────────────────┐
                          │ Next.js 14 Ops Console    │
                          │ (Dark Mode Control Center)│
                          └───────────────────────────┘
```

---

## Directory Structure

```
CutGuard_AI/
├── package.json                 # Monorepo orchestrator scripts
├── run-pipeline.bat             # Start mock media worker (Port 4001)
├── run-agent.bat                # Start Python SRE agent (Port 8000)
├── run-dashboard.bat            # Start Next.js dashboard (Port 3000)
├── start-all.bat                # Launches all 3 services concurrently
├── mock-pipeline/               # Target media worker service
│   ├── worker.js                # Express/Node transcode script with intentional crash
│   ├── queue-manager.js         # Downstream queue dispatcher
│   ├── stream-stitcher.js       # Downstream HLS master aggregator
│   ├── package.json
│   └── worker.test.js           # Jest unit tests (fails before patch; passes after)
├── sre-agent/                   # Python Agent Core (LangGraph + Gemini + MCP)
│   ├── requirements.txt         # langgraph, google-genai, mcp, fastapi, uvicorn
│   ├── agent.py                 # LangGraph cyclic state machine with interrupt()
│   ├── mcp_client.py            # Stdio client connecting to official `mcp-grafana`
│   ├── tools.py                 # AST blast-radius analyzer and isolated sandbox runner
│   ├── server.py                # FastAPI REST & WebSocket server
│   ├── .env.example             # Environment variable template
│   └── .venv/                   # Python 3.13 virtual environment
└── dashboard/                   # Next.js 14 App Router + Tailwind CSS
    ├── app/
    │   ├── page.tsx             # Incident Control Center dashboard
    │   ├── layout.tsx
    │   └── globals.css
    ├── components/
    │   ├── Header.tsx           # Telemetry status pills & simulate button
    │   ├── IncidentFeed.tsx     # 6-stage lifecycle progress tracker
    │   ├── BlastRadiusRadar.tsx # Visual impact gauge & affected microservices
    │   ├── DiffViewer.tsx       # Syntax-highlighted unified Git patch viewer
    │   ├── SandboxLogs.tsx      # Terminal-style Jest unit test output
    │   ├── HumanApprovalBar.tsx # SRE Decision Gate (Approve / Reject buttons)
    │   └── PostMortemModal.tsx  # Enterprise RCA report modal & export
    └── package.json
```

---

## Quickstart Guide

### Option 1: Single Root Orchestrator (Recommended — All Platforms)
Run a single command from the project root to start all three tiers concurrently with unified colored logs and graceful shutdown:
```bash
npm run dev:all
```
*(Alternative shortcuts: `npm run dev` or `npm start`)*

This launches:
- **Mock Media Pipeline Worker:** `http://localhost:4001`
- **FastAPI SRE Agent & LangGraph API:** `http://localhost:8000`
- **Next.js Mission Control Console:** `http://localhost:3000`

---

### Option 2: Docker Compose (Containerized Multi-Tier)
Run the entire CutGuard AI architecture in isolated containers with a single command:
```bash
docker compose up --build
```
*(Or `docker-compose up --build`)*

To stop all containers:
```bash
docker compose down
```

---

### Option 3: One-Click Launch (Windows Batch Script)
Double-click `start-all.bat` or run in terminal:
```cmd
start-all.bat
```

---

### Option 4: Manual Step-by-Step Startup
**1. Mock Media Pipeline (Port 4001):**
```bash
cd mock-pipeline
npm install
npm run dev
```

**2. Autonomous SRE Agent (Port 8000):**
```bash
cd sre-agent
# Activate preconfigured virtual environment:
# On Windows: .venv\Scripts\activate
# On Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
python server.py
```

**3. Mission Control Dashboard (Port 3000):**
```bash
cd dashboard
npm install
npm run dev
```

Open your browser at `http://localhost:3000`.

---

## Configuration & Environment Variables

Copy `sre-agent/.env.example` to `sre-agent/.env` (and optionally `dashboard/.env.example` to `dashboard/.env.local`):
```ini
# Google Gemini API Key (Optional: CutGuard uses deterministic fallback if key is omitted)
GEMINI_API_KEY=your_gemini_api_key_here

# Grafana Loki MCP Configuration (Optional: High-fidelity telemetry simulator if omitted)
GRAFANA_URL=http://localhost:3000
GRAFANA_SERVICE_ACCOUNT_TOKEN=glsa_your_grafana_token_here

# Base URLs & Endpoints
PIPELINE_PORT=4001
AGENT_PORT=8000
DASHBOARD_PORT=3000
NEXT_PUBLIC_PIPELINE_URL=http://localhost:4001
NEXT_PUBLIC_AGENT_URL=http://localhost:8000
```

> **Note for Judges:** CutGuard AI is built with resilience. If live Grafana credentials or Gemini API keys are omitted, the system seamlessly uses realistic GKE cinema crash logs and deterministic AST patching so you can experience the end-to-end flow immediately with zero setup friction!

---

## Step-by-Step Incident Walkthrough

1. **Trigger Incident:** In the Video Stream Player (`http://localhost:4001/player`) click **"Simulate Stream Failure"**, or dispatch via Swagger API (`http://localhost:4001/docs`).
2. **Grafana Ingestion:** The agent calls `mcp_client.py` to query Loki logs for `{app="ffmpeg-transcoder"} |= "CRITICAL"`.
3. **Gemini Triage:** Gemini 2.5 Flash analyzes the stack trace and isolates the crash to `mock-pipeline/worker.js:32`.
4. **Blast Radius Analysis:** Static call-graph analysis identifies downstream services (`queue-manager.js`, `stream-stitcher.js`) and calculates an 80/100 Threat Score.
5. **Sandbox Healing Loop:** Gemini 2.5 Pro generates a Git Unified Diff patch. The agent runs Jest tests (`worker.test.js`) inside an isolated sandbox subprocess. Tests pass!
6. **Human-in-the-Loop Gate:** LangGraph native `interrupt()` halts execution. The Ops Console displays the unified patch, test logs, and blast radius.
7. **Approve & Deploy:** Click **[Approve & Deploy Fix]**. The agent resumes, permanently applies the patch, commits to Git with tag `fix(sre): autonomous transcode patch`, and generates the Enterprise Post-Mortem RCA.

---

## License
Apache 2.0. Built for the Google Cloud & Devpost Agentic Cinema Hackathon.
