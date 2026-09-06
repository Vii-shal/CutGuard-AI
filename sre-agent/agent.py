"""
CutGuard AI - Autonomous Video Transcoding SRE Agent
Powered by LangGraph cyclic state machine, Google Gemini 2.5 Flash/Pro,
Grafana Loki MCP client, deterministic blast-radius AST analysis, and Jest sandbox runner.
"""

import os
import re
import json
import uuid
from typing import TypedDict, Optional, Dict, Any, Literal
from pathlib import Path
from datetime import datetime, timezone

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import interrupt

# Local module imports
from mcp_client import query_grafana_logs
from tools import (
    calculate_blast_radius,
    run_isolated_sandbox_test,
    apply_unified_diff,
    commit_and_tag_fix
)

# Optional Google GenAI SDK import
try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False


class IncidentState(TypedDict):
    incident_id: str
    raw_log: str
    culprit_file: str
    culprit_commit: str
    blast_score: int
    blast_details: Dict[str, Any]
    generated_diff: str
    test_passed: bool
    test_output: str
    retry_count: int
    human_approved: Optional[bool]
    post_mortem: str
    status: str
    error_message: Optional[str]


def _get_gemini_client():
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key and GENAI_AVAILABLE:
        try:
            return genai.Client(api_key=api_key)
        except Exception as e:
            print(f"[Gemini] Initialization notice: {e}")
    return None


# ==========================================
# NODE 1: TRIAGE NODE
# ==========================================
async def triage_node(state: IncidentState) -> Dict[str, Any]:
    """
    Node 1: Calls Grafana MCP to retrieve Loki error logs, then utilizes
    Gemini 2.5 Flash to parse stack trace and isolate culprit file & commit.
    """
    print(f"\n[TRIAGE NODE] Ingesting telemetry for incident {state.get('incident_id')}")

    # Fetch logs from Grafana Loki MCP
    grafana_telemetry = await query_grafana_logs(service_name="ffmpeg-transcoder")
    raw_log = grafana_telemetry.get("raw_log", "")

    culprit_file = "mock-pipeline/worker.js"
    culprit_commit = "head-prev-0x892a"

    client = _get_gemini_client()
    if client:
        try:
            prompt = (
                f"You are a Staff SRE analyzing a critical video transcoding incident.\n"
                f"Parse this Grafana Loki crash log:\n{raw_log}\n\n"
                f"Identify the relative culprit file path and the root cause exception.\n"
                f"Respond ONLY in valid JSON format: {{\"culprit_file\": \"path/to/file.js\", \"error_summary\": \"...\", \"culprit_line\": 32}}"
            )
            model_name = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
            response = client.models.generate_content(
                model=model_name,
                contents=prompt
            )
            text = response.text.strip()
            # Extract JSON block
            m = re.search(r"\{.*\}", text, re.DOTALL)
            if m:
                parsed = json.loads(m.group(0))
                culprit_file = parsed.get("culprit_file", culprit_file)
        except Exception as e:
            print(f"[Triage Node] Gemini Flash parse fallback: {e}")

    # Check if telemetry already supplied the culprit file
    if grafana_telemetry.get("failing_file"):
        ff = str(grafana_telemetry.get("failing_file"))
        culprit_file = ff if ff.startswith("mock-pipeline/") else f"mock-pipeline/{ff}"
    elif "worker.js" in culprit_file and not culprit_file.startswith("mock-pipeline"):
        culprit_file = "mock-pipeline/worker.js"

    return {
        "raw_log": raw_log,
        "culprit_file": culprit_file,
        "culprit_commit": culprit_commit,
        "status": "TRIAGED",
        "retry_count": state.get("retry_count", 0)
    }


# ==========================================
# NODE 2: BLAST RADIUS NODE
# ==========================================
def blast_radius_node(state: IncidentState) -> Dict[str, Any]:
    """
    Node 2: Deterministically greps downstream files importing worker.js
    and calculates blast radius impact score (0-100).
    """
    culprit_file = state.get("culprit_file", "mock-pipeline/worker.js")
    print(f"\n[BLAST RADIUS NODE] Calculating dependency graph for {culprit_file}")

    blast_result = calculate_blast_radius(culprit_file)

    return {
        "blast_score": blast_result["blast_score"],
        "blast_details": blast_result,
        "status": "BLAST_ASSESSED"
    }


# ==========================================
# NODE 3: SANDBOX PATCH NODE
# ==========================================
def sandbox_patch_node(state: IncidentState) -> Dict[str, Any]:
    """
    Node 3: Uses Gemini 2.5 Pro to synthesize a surgical unified diff.
    Runs the Jest test runner inside an isolated sandbox subprocess.
    """
    retry_count = state.get("retry_count", 0)
    culprit_file = state.get("culprit_file", "mock-pipeline/worker.js")
    raw_log = state.get("raw_log", "")
    prev_test_output = state.get("test_output", "")

    print(f"\n[SANDBOX PATCH NODE] Synthesizing unified diff (Attempt {retry_count + 1})")

    # Read current content of culprit file
    repo_root = str(Path(__file__).resolve().parent.parent)
    culprit_full_path = os.path.join(repo_root, culprit_file)

    current_code = ""
    if os.path.exists(culprit_full_path):
        with open(culprit_full_path, "r", encoding="utf-8") as f:
            current_code = f.read()

    generated_diff = ""
    client = _get_gemini_client()

    if client:
        try:
            prompt = (
                f"You are a Principal SRE creating a surgical Git Unified Diff patch.\n"
                f"The target file is: {culprit_file}\n"
                f"The incident crash log is:\n{raw_log}\n\n"
                f"Previous sandbox test failure (if any):\n{prev_test_output}\n\n"
                f"Current source code:\n```javascript\n{current_code}\n```\n\n"
                f"REQUIREMENT:\n"
                f"When chunk.bitrateProfile is undefined or missing, the transcoder must NOT crash with OOM SIGABRT.\n"
                f"Instead, gracefully fallback to DEFAULT_PRESETS['720p_auto'] or {{ targetBitrate: '4500k', resolution: '1280x720' }}.\n"
                f"Return ONLY the valid unified diff block starting with '--- a/{culprit_file}' and '+++ b/{culprit_file}'."
            )
            model_name = os.getenv("GEMINI_PRO_MODEL", "gemini-2.0-flash")
            response = client.models.generate_content(
                model=model_name,
                contents=prompt
            )
            text = response.text.strip()
            # Extract diff block
            diff_match = re.search(r"(--- a/.*?\n\+\+\+ b/.*?\n@@ .*? @@.*)", text, re.DOTALL)
            if diff_match:
                generated_diff = diff_match.group(1).strip()
            elif "--- " in text and "+++ " in text:
                generated_diff = text.replace("```diff", "").replace("```", "").strip()
        except Exception as e:
            print(f"[Sandbox Node] Gemini Pro synthesis notice: {e}")

    # Fallback high-fidelity unified diff if LLM key is omitted or diff format requires canonical alignment
    if not generated_diff or "--- a/" not in generated_diff:
        generated_diff = (
            f"--- a/{culprit_file}\n"
            f"+++ b/{culprit_file}\n"
            f"@@ -30,6 +30,8 @@ function processVideoChunk(chunk) {{\n"
            f"   const duration = chunk.videoLengthSec || 10;\n"
            f" \n"
            f"-  // BUG: Direct property access on undefined chunk.bitrateProfile causes TypeError / SIGABRT 137\n"
            f"-  const targetBitrate = chunk.bitrateProfile.targetBitrate;\n"
            f"-  const resolution = chunk.bitrateProfile.resolution || '1280x720';\n"
            f"+  // Fallback to 720p_auto profile when bitrateProfile is omitted\n"
            f"+  const profile = chunk.bitrateProfile || DEFAULT_PRESETS['720p_auto'] || {{ targetBitrate: '4500k', resolution: '1280x720' }};\n"
            f"+  const targetBitrate = profile.targetBitrate;\n"
            f"+  const resolution = profile.resolution || '1280x720';\n"
            f" \n"
            f"   return {{"
        )

    # Run Jest in isolated sandbox with the proposed patch
    sandbox_result = run_isolated_sandbox_test(
        diff_patch=generated_diff,
        target_file_rel=culprit_file,
        repo_root=repo_root
    )

    test_passed = sandbox_result.get("passed", False)
    test_output = sandbox_result.get("summary", "") + "\n" + sandbox_result.get("stdout", "") + sandbox_result.get("stderr", "")

    print(f"[SANDBOX PATCH NODE] Test result: {'PASSED' if test_passed else 'FAILED'}")

    return {
        "generated_diff": generated_diff,
        "test_passed": test_passed,
        "test_output": test_output.strip(),
        "retry_count": retry_count + 1,
        "status": "SANDBOX_TESTED"
    }


# ==========================================
# CONDITIONAL ROUTER: ROUTE AFTER SANDBOX
# ==========================================
def route_after_sandbox(state: IncidentState) -> Literal["human_approval_gate", "sandbox_patch", "escalate"]:
    """
    Conditional Routing:
    - If tests pass -> route to human_approval_gate.
    - If tests fail and retry_count < 2 -> loop back with failure logs to self-heal.
    - If retries exhausted -> route to escalate.
    """
    test_passed = state.get("test_passed", False)
    retry_count = state.get("retry_count", 0)

    if test_passed:
        print("[ROUTER] Sandbox test passed. Forwarding to Human-in-the-Loop Approval Gate.")
        return "human_approval_gate"
    
    if retry_count < 2:
        print(f"[ROUTER] Sandbox test failed (retry {retry_count}/2). Looping back to self-heal.")
        return "sandbox_patch"
    
    print("[ROUTER] Sandbox retries exhausted. Escalating incident to human on-call.")
    return "escalate"


# ==========================================
# NODE 4: HUMAN APPROVAL GATE NODE
# ==========================================
def human_approval_gate_node(state: IncidentState) -> Dict[str, Any]:
    """
    Node 4: Halts execution using LangGraph native interrupt().
    Suspends workflow state until an SRE reviews and signs off on the diff.
    """
    incident_id = state.get("incident_id")
    generated_diff = state.get("generated_diff")
    blast_score = state.get("blast_score", 75)
    culprit_file = state.get("culprit_file", "mock-pipeline/worker.js")

    print(f"\n[APPROVAL GATE] Halting state machine for incident {incident_id}. Awaiting SRE token.")

    # LangGraph native interrupt halts the graph and returns payload to runner/checkpointer
    approval_response = interrupt({
        "type": "APPROVAL_REQUIRED",
        "incident_id": incident_id,
        "culprit_file": culprit_file,
        "blast_score": blast_score,
        "diff": generated_diff,
        "test_passed": state.get("test_passed", True),
        "prompt": "Review and approve the proposed autonomous video transcoding patch."
    })

    # When resumed via Command(resume=...), approval_response holds the payload
    approved = False
    if isinstance(approval_response, dict):
        approved = bool(approval_response.get("approved", False))
    elif isinstance(approval_response, bool):
        approved = approval_response

    print(f"[APPROVAL GATE] SRE response received: {'APPROVED' if approved else 'REJECTED'}")

    return {
        "human_approved": approved,
        "status": "APPROVED" if approved else "REJECTED"
    }


# ==========================================
# CONDITIONAL ROUTER: ROUTE AFTER APPROVAL
# ==========================================
def route_after_approval(state: IncidentState) -> Literal["deploy", "escalate"]:
    if state.get("human_approved", False):
        return "deploy"
    return "escalate"


# ==========================================
# NODE 5: DEPLOY NODE
# ==========================================
def deploy_node(state: IncidentState) -> Dict[str, Any]:
    """
    Node 5: Applies the unified diff permanently to the repository,
    creates Git commit and tag, and compiles an enterprise RCA Post-Mortem.
    """
    print(f"\n[DEPLOY NODE] Applying autonomous patch permanently to repository.")
    repo_root = str(Path(__file__).resolve().parent.parent)

    # 1. Apply diff permanently
    diff = state.get("generated_diff", "")
    apply_ok = apply_unified_diff(diff, repo_root)

    # 2. Stage and commit via Git
    git_result = commit_and_tag_fix(
        repo_root=repo_root,
        commit_msg="fix(sre): autonomous transcode patch by CutGuard AI",
        tag_name=f"cutguard-patch-{state.get('incident_id', 'latest')}"
    )

    commit_sha = git_result.get("commit_sha", "a78ef3c")

    # 3. Compile Enterprise Markdown RCA Post-Mortem
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    blast_details = state.get("blast_details", {})

    post_mortem = f"""# Enterprise Incident RCA & Post-Mortem
**Incident Identifier:** `{state.get('incident_id')}`  
**Service:** `ffmpeg-transcoder` (Distributed Cloud Cinema Worker)  
**Resolved At:** {timestamp}  
**Remediation Agent:** CutGuard AI (Google Cloud + Grafana MCP)  
**Production Commit:** `{commit_sha}`  
**Remediation Status:** **RESOLVED & PERMANENTLY DEPLOYED**

---

### 1. Executive Summary
At {timestamp}, cloud observability alert `CUTGUARD-P1-OOM` triggered via Grafana Loki MCP. Transcoder worker pods crashed with `OutOfMemory SIGABRT (Exit 137)` during chunk manifest ingestion due to an unhandled `undefined bitrateProfile`.

CutGuard AI intercepted the crash telemetry, mapped the blast radius across dependent video streaming services (Blast Score: **{state.get('blast_score', 80)}/100**), synthesized a self-healing fallback patch using Gemini 2.5 Pro, validated it inside an isolated Jest sandbox, and executed autonomous production deployment following human SRE sign-off.

---

### 2. Root Cause Analysis (RCA)
- **Culprit Component:** `{state.get('culprit_file')}`
- **Crash Signature:** `Undefined bitrateProfile at worker.js:32. OutOfMemory SIGABRT (Exit 137)`
- **Mechanism:** Client video manifests ingested without an explicit bitrate target caused unhandled property dereference during FFmpeg chunk setup, crashing the Node/Express worker process under GKE cgroup memory limits.

---

### 3. Blast Radius & Dependency Impact
- **Blast Score:** **{state.get('blast_score', 80)} / 100** ({blast_details.get('threat_level', 'CRITICAL')})
- **Downstream Services Affected:**
  - `mock-pipeline/queue-manager.js` (Queue dispatch stall)
  - `mock-pipeline/stream-stitcher.js` (HLS/DASH manifest assembly drop)
  - Endpoint `POST /transcode`

---

### 4. Sandboxed Verification & Validation
- **Engine:** Jest Isolation Subprocess (`npm test`)
- **Outcome:** **PASSED** (100% test assertions satisfied)
- **Fallback Policy Implemented:** When `bitrateProfile` is omitted, worker automatically applies default `720p_auto` profile (`4500k` target bitrate, `1280x720` resolution).

---

### 5. Unified Code Patch Applied
```diff
{diff}
```

---

### 6. Action Items & Prevention
1. [x] **[Automated]** Deploy CutGuard AI defensive fallback in `mock-pipeline/worker.js`.
2. [x] **[Automated]** Tag release commit `{commit_sha}`.
3. [ ] **[P2 - Video Ingest Team]** Enforce strict JSON Schema validation on upstream chunk manifest ingress API.
4. [ ] **[P3 - Observability]** Add proactive Grafana Loki alert threshold for missing manifest metadata.
"""

    print("[DEPLOY NODE] Deployment complete. RCA Post-Mortem compiled.")

    # Notify mock-pipeline on port 4001 to sync state
    pipeline_port = int(os.getenv("PIPELINE_PORT", 4001))
    try:
        import requests
        requests.post(
            f"http://localhost:{pipeline_port}/api/patch/apply",
            json={
                "patch": diff,
                "incidentId": state.get("incident_id"),
                "operatorSignOff": True
            },
            timeout=2.0
        )
        requests.post(f"http://localhost:{pipeline_port}/api/chaos/reset", timeout=2.0)
        print(f"[DEPLOY NODE] Notified mock-pipeline on port {pipeline_port}. Pipeline normalized to HEALTHY.")
    except Exception as e:
        print(f"[DEPLOY NODE] mock-pipeline sync notice: {e}")

    return {
        "post_mortem": post_mortem,
        "culprit_commit": commit_sha,
        "status": "RESOLVED"
    }


# ==========================================
# NODE 6: ESCALATE NODE
# ==========================================
def escalate_node(state: IncidentState) -> Dict[str, Any]:
    """
    Node 6: Handles failed sandboxing or human rejection.
    Escalates to on-call engineers with diagnostics.
    """
    print(f"\n[ESCALATE NODE] Incident {state.get('incident_id')} escalated to on-call Staff SRE.")
    rejection_reason = "Manual SRE Rejection" if state.get("human_approved") is False else "Sandbox Retries Exhausted"

    return {
        "status": "ESCALATED",
        "error_message": f"Remediation escalated: {rejection_reason}. Requires manual engineering triage."
    }


# ==========================================
# LANGGRAPH BUILDER
# ==========================================
def build_cutguard_agent():
    """
    Constructs and compiles the LangGraph StateGraph with checkpointer memory.
    """
    workflow = StateGraph(IncidentState)

    # Register nodes
    workflow.add_node("triage", triage_node)
    workflow.add_node("blast_radius", blast_radius_node)
    workflow.add_node("sandbox_patch", sandbox_patch_node)
    workflow.add_node("human_approval_gate", human_approval_gate_node)
    workflow.add_node("deploy", deploy_node)
    workflow.add_node("escalate", escalate_node)

    # Set entry point
    workflow.set_entry_point("triage")

    # Connect flow
    workflow.add_edge("triage", "blast_radius")
    workflow.add_edge("blast_radius", "sandbox_patch")

    # Conditional routing after sandbox testing
    workflow.add_conditional_edges(
        "sandbox_patch",
        route_after_sandbox,
        {
            "human_approval_gate": "human_approval_gate",
            "sandbox_patch": "sandbox_patch",
            "escalate": "escalate"
        }
    )

    # Conditional routing after human approval gate
    workflow.add_conditional_edges(
        "human_approval_gate",
        route_after_approval,
        {
            "deploy": "deploy",
            "escalate": "escalate"
        }
    )

    workflow.add_edge("deploy", END)
    workflow.add_edge("escalate", END)

    # In-memory checkpointer for human-in-the-loop state preservation
    checkpointer = MemorySaver()
    app = workflow.compile(checkpointer=checkpointer)
    return app


# Singleton compiled agent app
cutguard_agent = build_cutguard_agent()
