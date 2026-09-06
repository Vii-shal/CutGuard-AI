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
from agent import cutguard_agent, IncidentState

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


class TriggerRequest(BaseModel):
    service_name: Optional[str] = "ffmpeg-transcoder"
    custom_log: Optional[str] = None


class ResumeRequest(BaseModel):
    approved: bool
    approver: Optional[str] = "Lead SRE Engineer"
    notes: Optional[str] = "Approved automated 720p_auto fallback patch."


async def broadcast_incident_update(incident_id: str, data: Dict[str, Any]):
    """Pushes live state updates to all subscribed WebSocket clients."""
    if incident_id in ACTIVE_WEBSOCKETS:
        dead_connections = []
        for ws in ACTIVE_WEBSOCKETS[incident_id]:
            try:
                await ws.send_json(data)
            except Exception:
                dead_connections.append(ws)
        for dead in dead_connections:
            ACTIVE_WEBSOCKETS[incident_id].remove(dead)


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
    return {
        "status": "online",
        "agent": "CutGuard AI",
        "version": "1.0.0",
        "grafana_mcp": "configured" if os.getenv("GRAFANA_URL") else "simulation_mode",
        "gemini_api": "active" if os.getenv("GEMINI_API_KEY") else "deterministic_fallback"
    }


@app.post("/api/incident/trigger")
async def trigger_incident(req: TriggerRequest, background_tasks: BackgroundTasks):
    """
    Initiates an autonomous SRE incident remediation cycle.
    """
    timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    incident_id = f"inc-{timestamp_str}-{uuid.uuid4().hex[:4]}"

    initial_record = {
        "incident_id": incident_id,
        "service": req.service_name or "ffmpeg-transcoder",
        "status": "INITIALIZING",
        "raw_log": req.custom_log or "",
        "culprit_file": "mock-pipeline/worker.js",
        "culprit_commit": "HEAD~1",
        "blast_score": 0,
        "blast_details": {},
        "generated_diff": "",
        "test_passed": False,
        "test_output": "",
        "retry_count": 0,
        "human_approved": None,
        "post_mortem": "",
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    INCIDENTS_DB[incident_id] = initial_record

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

    if not graph_state.tasks or not any(t.interrupts for t in graph_state.tasks):
        # Even if not paused in state, update record directly
        INCIDENTS_DB[incident_id]["human_approved"] = req.approved
        INCIDENTS_DB[incident_id]["status"] = "RESOLVED" if req.approved else "ESCALATED"
        await broadcast_incident_update(incident_id, INCIDENTS_DB[incident_id])
        return INCIDENTS_DB[incident_id]

    async def _resume():
        INCIDENTS_DB[incident_id]["status"] = "DEPLOYING" if req.approved else "REJECTING"
        await broadcast_incident_update(incident_id, INCIDENTS_DB[incident_id])

        resume_payload = {"approved": req.approved, "approver": req.approver}
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
        "approved": req.approved
    }


@app.get("/api/incidents")
async def list_incidents():
    incidents_list = list(INCIDENTS_DB.values())
    incidents_list.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return {"incidents": incidents_list}


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
    port = int(os.getenv("AGENT_PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)
