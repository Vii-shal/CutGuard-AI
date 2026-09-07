"""
CutGuard AI - FastAPI SRE Incident Server
Exposes REST and WebSocket endpoints to trigger incident simulations,
stream LangGraph state progression, and resume workflows via human-in-the-loop approvals.
"""

import os
import sys
import json
import uuid
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List

from fastapi import FastAPI, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Load local environment
load_dotenv()

# Import LangGraph agent and types
from langgraph.types import Command
from agent import cutguard_agent, IncidentState, _get_gemini_client, GENAI_AVAILABLE, LAST_GEMINI_ERROR
from gitops import close_github_hotfix_pr

app = FastAPI(
    title="CutGuard AI - Autonomous SRE Agent API",
    version="1.0.0",
    description="Autonomous incident triage and remediation agent for cloud media pipelines."
)

# Enable CORS for Next.js dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store for active incidents and thread IDs
INCIDENTS_DB: Dict[str, Dict[str, Any]] = {}
ACTIVE_WEBSOCKETS: Dict[str, List[WebSocket]] = {}
GLOBAL_WEBSOCKETS: List[WebSocket] = []


class TriggerRequest(BaseModel):
    service_name: Optional[str] = "ffmpeg-transcoder"
    raw_logs: Optional[str] = None
    custom_log: Optional[str] = None
    incident_id: Optional[str] = None
    timestamp: Optional[str] = None


class ResumeRequest(BaseModel):
    approved: Optional[bool] = None
    action: Optional[str] = None
    approver: Optional[str] = "Lead SRE Engineer"
    notes: Optional[str] = "Approved autonomous patch after sandbox verification."


async def broadcast_incident_update(incident_id: str, data: Dict[str, Any]):
    """Pushes live state updates to all subscribed WebSocket clients."""
    # 1. Broadcast to specific incident subscribers
    if incident_id in ACTIVE_WEBSOCKETS:
        dead_connections = []
        for ws in ACTIVE_WEBSOCKETS[incident_id]:
            try:
                await ws.send_json(data)
            except Exception:
                dead_connections.append(ws)
        for dead in dead_connections:
            ACTIVE_WEBSOCKETS[incident_id].remove(dead)

    # 2. Broadcast to global live dashboard subscribers
    dead_globals = []
    for ws in GLOBAL_WEBSOCKETS:
        try:
            await ws.send_json({"event": "incident_update", "incident": data})
        except Exception:
            dead_globals.append(ws)
    for dead in dead_globals:
        GLOBAL_WEBSOCKETS.remove(dead)


async def execute_agent_workflow(incident_id: str, initial_state: Dict[str, Any]):
    """
    Executes LangGraph agent asynchronously until it either interrupts or finishes.
    """
    config = {"configurable": {"thread_id": incident_id}}
    INCIDENTS_DB[incident_id]["status"] = "ANALYZING"
    await broadcast_incident_update(incident_id, INCIDENTS_DB[incident_id])

    try:
        # Stream events from LangGraph
        async for chunk in cutguard_agent.astream(initial_state, config=config):
            for node_name, node_output in chunk.items():
                print(f"[Stream][{incident_id}] Node completed: {node_name}")
                if isinstance(node_output, dict):
                    INCIDENTS_DB[incident_id].update(node_output)
                if node_name == "triage":
                    INCIDENTS_DB[incident_id]["status"] = "TRIAGED"
                elif node_name == "blast_radius":
                    INCIDENTS_DB[incident_id]["status"] = "BLAST_ASSESSED"
                elif node_name == "sandbox_patch":
                    INCIDENTS_DB[incident_id]["status"] = "SANDBOXED"
                elif node_name == "deploy":
                    INCIDENTS_DB[incident_id]["status"] = "RESOLVED"
                elif node_name == "escalate":
                    INCIDENTS_DB[incident_id]["status"] = "ESCALATED"
                elif node_name == "__interrupt__":
                    INCIDENTS_DB[incident_id]["status"] = "NEEDS_APPROVAL"

                await broadcast_incident_update(incident_id, INCIDENTS_DB[incident_id])

        # Check if execution was interrupted by human_approval_gate
        graph_state = cutguard_agent.get_state(config)
        if graph_state.tasks:
            for task in graph_state.tasks:
                if task.interrupts:
                    print(f"[Agent][{incident_id}] Graph halted at interrupt. Awaiting approval.")
                    INCIDENTS_DB[incident_id]["status"] = "NEEDS_APPROVAL"
                    INCIDENTS_DB[incident_id]["interrupt_payload"] = task.interrupts[0].value
                    await broadcast_incident_update(incident_id, INCIDENTS_DB[incident_id])
                    return

    except Exception as e:
        print(f"[Agent Error][{incident_id}] {e}")
        INCIDENTS_DB[incident_id]["status"] = "ERROR"
        INCIDENTS_DB[incident_id]["error_message"] = str(e)
        await broadcast_incident_update(incident_id, INCIDENTS_DB[incident_id])


@app.get("/api/health")
async def health_check():
    client = _get_gemini_client()
    raw_key = os.getenv("GEMINI_API_KEY", "")
    clean_key = raw_key.strip().strip("'\"")
    return {
        "status": "online",
        "agent": "CutGuard AI",
        "version": "1.0.0",
        "grafana_mcp": "configured" if os.getenv("GRAFANA_URL") else "simulation_mode",
        "gemini_api": "active" if clean_key else "missing_key",
        "genai_sdk_installed": GENAI_AVAILABLE,
        "client_initialized": bool(client),
        "last_gemini_error": LAST_GEMINI_ERROR,
        "key_length": len(clean_key),
        "key_preview": f"{clean_key[:6]}...{clean_key[-4:]}" if len(clean_key) >= 10 else "too_short"
    }


@app.post("/api/incident/trigger")
async def trigger_incident(req: TriggerRequest, background_tasks: BackgroundTasks):
    """
    Initiates an autonomous SRE incident remediation cycle.
    """
    timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    incident_id = req.incident_id or f"inc-{timestamp_str}-{uuid.uuid4().hex[:4]}"
    raw_log = req.raw_logs or req.custom_log or ""
    culprit_file = ""  # Discovered dynamically by triage node via stack trace analysis

    initial_record = {
        "incident_id": incident_id,
        "service": req.service_name or "ffmpeg-transcoder",
        "status": "INITIALIZING",
        "raw_log": raw_log,
        "culprit_file": culprit_file,
        "culprit_commit": "HEAD~1",
        "blast_score": 0,
        "blast_details": {},
        "generated_diff": "",
        "test_passed": False,
        "test_output": "",
        "retry_count": 0,
        "human_approved": None,
        "post_mortem": "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "pr_url": None,
        "pr_number": None,
        "pr_branch": None
    }

    INCIDENTS_DB[incident_id] = initial_record

    # Broadcast immediately to all connected dashboards that an agent has started!
    await broadcast_incident_update(incident_id, initial_record)

    # Launch LangGraph in background task
    background_tasks.add_task(
        execute_agent_workflow,
        incident_id,
        initial_record
    )

    return {
        "success": True,
        "incident_id": incident_id,
        "message": f"CutGuard SRE agent dispatched for incident {incident_id}",
        "status": "INITIALIZING"
    }


@app.get("/api/incident/{incident_id}/status")
async def get_incident_status(incident_id: str):
    if incident_id not in INCIDENTS_DB:
        raise HTTPException(status_code=404, detail="Incident not found")
    return INCIDENTS_DB[incident_id]


@app.post("/api/incident/{incident_id}/resume")
async def resume_incident(incident_id: str, req: ResumeRequest, background_tasks: BackgroundTasks):
    """
    Resumes a halted LangGraph execution waiting at human_approval_gate.
    """
    if incident_id not in INCIDENTS_DB:
        raise HTTPException(status_code=404, detail="Incident not found")

    config = {"configurable": {"thread_id": incident_id}}
    graph_state = cutguard_agent.get_state(config)

    is_approved = req.approved if req.approved is not None else (str(req.action).lower() == "approve")

    if not graph_state.tasks or not any(t.interrupts for t in graph_state.tasks):
        # Even if not paused in state, update record directly
        INCIDENTS_DB[incident_id]["human_approved"] = is_approved
        INCIDENTS_DB[incident_id]["status"] = "RESOLVED" if is_approved else "ESCALATED"
        await broadcast_incident_update(incident_id, INCIDENTS_DB[incident_id])
        return INCIDENTS_DB[incident_id]

    async def _resume():
        INCIDENTS_DB[incident_id]["status"] = "DEPLOYING" if is_approved else "REJECTING"
        await broadcast_incident_update(incident_id, INCIDENTS_DB[incident_id])

        resume_payload = {"approved": is_approved, "action": "approve" if is_approved else "reject", "approver": req.approver}
        command = Command(resume=resume_payload)

        async for chunk in cutguard_agent.astream(command, config=config):
            for node_name, node_output in chunk.items():
                print(f"[Resume Stream][{incident_id}] Node completed: {node_name}")
                if isinstance(node_output, dict):
                    INCIDENTS_DB[incident_id].update(node_output)
                if node_name == "deploy":
                    INCIDENTS_DB[incident_id]["status"] = "RESOLVED"
                elif node_name == "escalate":
                    INCIDENTS_DB[incident_id]["status"] = "ESCALATED"
                await broadcast_incident_update(incident_id, INCIDENTS_DB[incident_id])

    background_tasks.add_task(_resume)

    return {
        "success": True,
        "incident_id": incident_id,
        "message": "Human approval token processed. Resuming deployment graph.",
        "approved": is_approved
    }


@app.get("/api/incidents")
async def list_incidents():
    incidents_list = list(INCIDENTS_DB.values())
    incidents_list.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return {"incidents": incidents_list}


@app.get("/api/incident/latest")
async def get_latest_incident():
    """Returns the most recent incident or null if none exist."""
    if not INCIDENTS_DB:
        return {"incident": None}
    incidents_list = list(INCIDENTS_DB.values())
    incidents_list.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return {"incident": incidents_list[0]}


@app.post("/api/incidents/clear")
async def clear_incidents(background_tasks: BackgroundTasks):
    """Clears all in-memory incident records to return cluster monitoring to nominal."""
    # Find any active PRs created during this session to close them cleanly in background
    for inc_id, record in list(INCIDENTS_DB.items()):
        pr_number = record.get("pr_number")
        pr_branch = record.get("pr_branch")
        if pr_number:
            print(f"[CutGuard Reset] Scheduling PR #{pr_number} and branch {pr_branch} cleanup")
            background_tasks.add_task(close_github_hotfix_pr, pr_number, pr_branch)

    INCIDENTS_DB.clear()
    dead_globals = []
    for ws in GLOBAL_WEBSOCKETS:
        try:
            await ws.send_json({"event": "incidents_cleared"})
        except Exception:
            dead_globals.append(ws)
    for dead in dead_globals:
        GLOBAL_WEBSOCKETS.remove(dead)
    return {"status": "CLEARED", "message": "All incident records cleared."}


@app.websocket("/ws/live")
async def websocket_live_endpoint(websocket: WebSocket):
    """Global real-time incident event stream for CutGuard dashboards."""
    await websocket.accept()
    if websocket not in GLOBAL_WEBSOCKETS:
        GLOBAL_WEBSOCKETS.append(websocket)

    # Immediately push current incident state upon connecting
    if INCIDENTS_DB:
        incidents_list = list(INCIDENTS_DB.values())
        incidents_list.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        try:
            await websocket.send_json({"event": "incident_state", "incident": incidents_list[0]})
        except Exception:
            pass

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in GLOBAL_WEBSOCKETS:
            GLOBAL_WEBSOCKETS.remove(websocket)


@app.websocket("/ws/{incident_id}")
async def websocket_endpoint(websocket: WebSocket, incident_id: str):
    await websocket.accept()
    if incident_id not in ACTIVE_WEBSOCKETS:
        ACTIVE_WEBSOCKETS[incident_id] = []
    ACTIVE_WEBSOCKETS[incident_id].append(websocket)

    # Immediately push current state if known
    if incident_id in INCIDENTS_DB:
        await websocket.send_json(INCIDENTS_DB[incident_id])

    try:
        while True:
            # Keep socket alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        if incident_id in ACTIVE_WEBSOCKETS and websocket in ACTIVE_WEBSOCKETS[incident_id]:
            ACTIVE_WEBSOCKETS[incident_id].remove(websocket)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", os.getenv("AGENT_PORT", 8000)))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)
