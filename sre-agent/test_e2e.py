"""
CutGuard AI - End-to-End Autonomous SRE Workflow Test
Verifies the complete cycle:
1. Baseline test failure detection (intentional crash)
2. LangGraph state machine execution through Triage, Blast Radius, and Sandbox Patching
3. Human-in-the-loop interruption gate
4. Autonomous deployment and Git tagging
5. Final Jest verification showing 100% test pass
"""

import os
import sys
import asyncio
from pathlib import Path

# Add sre-agent to sys.path
agent_dir = str(Path(__file__).resolve().parent)
if agent_dir not in sys.path:
    sys.path.insert(0, agent_dir)

from dotenv import load_dotenv

# Load sre-agent environment variables
load_dotenv(Path(__file__).resolve().parent / ".env")
load_dotenv()

from agent import cutguard_agent, IncidentState
from langgraph.types import Command
from tools import run_isolated_sandbox_test


async def run_e2e_verification():
    print("=================================================================")
    print("       CUTGUARD AI — END-TO-END SRE AGENT VERIFICATION          ")
    print("=================================================================\n")

    # Step 1: Confirm baseline test fails on unpatched worker.js
    print("[Step 1] Verifying baseline mock-pipeline failure...")
    baseline_res = run_isolated_sandbox_test()
    print(f"  Baseline Test Status: {'PASSED' if baseline_res['passed'] else 'FAILED (Expected intentional OOM bug)'}")
    assert not baseline_res["passed"], "Baseline test should fail before patch!"
    print("  [SUCCESS] Intentional crash successfully confirmed.\n")

    # Step 2: Initialize Incident & run LangGraph until interrupt
    incident_id = "inc-test-e2e-001"
    initial_state = {
        "incident_id": incident_id,
        "service": "ffmpeg-transcoder",
        "status": "INITIALIZING",
        "raw_log": "",
        "culprit_file": "",
        "culprit_commit": "HEAD~1",
        "blast_score": 0,
        "blast_details": {},
        "generated_diff": "",
        "test_passed": False,
        "test_output": "",
        "retry_count": 0,
        "human_approved": None,
        "post_mortem": ""
    }

    config = {"configurable": {"thread_id": incident_id}}
    print(f"[Step 2] Executing CutGuard LangGraph Agent for {incident_id}...")

    async for chunk in cutguard_agent.astream(initial_state, config=config):
        for node_name, output in chunk.items():
            if isinstance(output, dict):
                print(f"  --> Node completed: [{node_name.upper()}] | Status: {output.get('status', 'RUNNING')}")
                if "blast_score" in output:
                    print(f"      Calculated Blast Radius Score: {output['blast_score']}/100")
                if "generated_diff" in output:
                    print(f"      Unified Diff Generated ({len(output['generated_diff'].splitlines())} lines)")
                if "test_passed" in output:
                    print(f"      Sandbox Jest Test Result: {'PASSED' if output['test_passed'] else 'FAILED'}")
            else:
                print(f"  --> Node completed: [{node_name.upper()}] (Halting at interrupt gate)")

    # Step 3: Check that agent interrupted at Human-in-the-loop gate
    graph_state = cutguard_agent.get_state(config)
    assert graph_state.tasks and any(t.interrupts for t in graph_state.tasks), "Graph should interrupt at approval gate"
    print("\n[Step 3] LangGraph State successfully suspended at human_approval_gate!")
    interrupt_data = graph_state.tasks[0].interrupts[0].value
    print(f"  Interrupt Payload: {interrupt_data.get('prompt')}")
    print(f"  Culprit: {interrupt_data.get('culprit_file')} | Blast Score: {interrupt_data.get('blast_score')}/100\n")
    assert interrupt_data.get('culprit_file') == 'mock-pipeline/worker.js', f"Culprit file should be dynamically extracted from logs! Got: {interrupt_data.get('culprit_file')}"

    # Step 4: Simulate SRE Sign-off & Resume Workflow
    print("[Step 4] Simulating SRE Engineer approval token ('APPROVED = TRUE')...")
    resume_command = Command(resume={"approved": True, "approver": "Staff SRE Test Runner"})

    async for chunk in cutguard_agent.astream(resume_command, config=config):
        for node_name, output in chunk.items():
            if isinstance(output, dict):
                print(f"  --> Resume Node completed: [{node_name.upper()}] | Final Status: {output.get('status')}")
                if "post_mortem" in output:
                    print(f"      Enterprise Post-Mortem RCA Compiled ({len(output['post_mortem'])} bytes)")
            else:
                print(f"  --> Resume Node completed: [{node_name.upper()}]")

    # Step 5: Verify tests now pass on the permanently patched worker.js
    print("\n[Step 5] Running final verification test on deployed worker.js...")
    post_deploy_res = run_isolated_sandbox_test()
    print(f"  Post-Deploy Test Status: {'PASSED (100% assertions satisfied)' if post_deploy_res['passed'] else 'FAILED'}")
    assert post_deploy_res["passed"], "Post-deploy tests must pass!"

    print("\n=================================================================")
    print("       ALL CUTGUARD AI VERIFICATION ASSERTIONS PASSED!           ")
    print("=================================================================")


if __name__ == "__main__":
    asyncio.run(run_e2e_verification())
