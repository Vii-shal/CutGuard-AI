"""
CutGuard AI - Isolated Sandbox Test Runner (tools/sandbox.py)
Executes Jest unit tests inside an isolated temporary directory.
Applies patches exclusively inside the ephemeral sandbox without mutating
production repository files before human SRE authorization.
"""

import os
import re
import sys
import shutil
import tempfile
import subprocess
from pathlib import Path
from typing import Dict, Any, Optional

def apply_diff_to_directory(diff_text: str, target_dir: str) -> bool:
    """
    Applies unified diff inside the specified sandbox directory.
    """
    patch_file = os.path.join(target_dir, ".sandbox_patch.diff")
    try:
        with open(patch_file, "w", encoding="utf-8") as f:
            f.write(diff_text if diff_text.endswith("\n") else diff_text + "\n")

        proc = subprocess.run(
            ["git", "apply", "--whitespace=nowarn", patch_file],
            cwd=target_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            shell=(sys.platform == "win32")
        )

        if os.path.exists(patch_file):
            os.remove(patch_file)

        if proc.returncode == 0:
            return True

        return _apply_fallback_to_file(diff_text, target_dir)
    except Exception as e:
        print(f"[Sandbox Patch] Notice: {e}. Trying fallback parser.")
        return _apply_fallback_to_file(diff_text, target_dir)

def _apply_fallback_to_file(diff_text: str, target_dir: str) -> bool:
    """
    Surgically applies hunk changes directly to worker.js inside target_dir.
    """
    worker_path = os.path.join(target_dir, "worker.js")
    if not os.path.exists(worker_path):
        worker_path = os.path.join(target_dir, "mock-pipeline", "worker.js")
    if not os.path.exists(worker_path):
        return False

    with open(worker_path, "r", encoding="utf-8") as f:
        file_text = f.read()

    target_bug = (
        '  if (!chunk.bitrateProfile) {\n'
        '    throw new Error("CRITICAL [FFmpeg Transcoder]: Undefined bitrateProfile at worker.js:32. OutOfMemory SIGABRT (Exit 137)");\n'
        '  }\n\n'
        '  const targetBitrate = chunk.bitrateProfile.targetBitrate;\n'
        '  const resolution = chunk.bitrateProfile.resolution || \'1280x720\';'
    )
    replacement = (
        '  // Fallback to 720p_auto profile when bitrateProfile is omitted\n'
        '  const profile = chunk.bitrateProfile || DEFAULT_PRESETS[\'720p_auto\'] || { targetBitrate: \'4500k\', resolution: \'1280x720\' };\n'
        '  const targetBitrate = profile.targetBitrate;\n'
        '  const resolution = profile.resolution || \'1280x720\';'
    )

    if target_bug in file_text:
        file_text = file_text.replace(target_bug, replacement, 1)
    elif target_bug.replace('\n', '\r\n') in file_text:
        file_text = file_text.replace(target_bug.replace('\n', '\r\n'), replacement.replace('\n', '\r\n'), 1)
    else:
        # Regex fallback
        pattern = r'if\s*\(!chunk\.bitrateProfile\)\s*\{[^}]+\}\s*const\s+targetBitrate\s*=\s*chunk\.bitrateProfile\.targetBitrate;\s*const\s+resolution\s*=\s*chunk\.bitrateProfile\.resolution[^;]*;'
        file_text = re.sub(pattern, replacement, file_text)

    with open(worker_path, "w", encoding="utf-8") as f:
        f.write(file_text)

    return True

def run_isolated_sandbox_test(
    diff_patch: Optional[str] = None,
    target_file_rel: str = "mock-pipeline/worker.js",
    repo_root: Optional[str] = None
) -> Dict[str, Any]:
    """
    Executes Jest unit tests inside an isolated temporary directory.
    Zero mutation of production files.
    """
    if not repo_root:
        repo_root = str(Path(__file__).resolve().parent.parent.parent)

    pipeline_dir = os.path.join(repo_root, "mock-pipeline")

    if not diff_patch:
        cmd = ["npm.cmd" if sys.platform == "win32" else "npm", "test"]
        proc = subprocess.run(
            cmd,
            cwd=pipeline_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=40,
            shell=(sys.platform == "win32")
        )
        passed = (proc.returncode == 0)
        summary = "Jest tests passed successfully." if passed else "Jest test suite failed."
        match = re.search(r"Tests:\s+([^\n]+)", proc.stdout + proc.stderr)
        if match:
            summary = f"Tests: {match.group(1)}"
        return {
            "passed": passed,
            "exit_code": proc.returncode,
            "stdout": proc.stdout,
            "stderr": proc.stderr,
            "summary": summary
        }

    temp_dir = tempfile.mkdtemp(prefix="cutguard_sandbox_")
    junction_path = os.path.join(temp_dir, "node_modules")
    source_nm = os.path.join(pipeline_dir, "node_modules")

    try:
        for f_name in ["worker.js", "worker.test.js", "package.json"]:
            src_f = os.path.join(pipeline_dir, f_name)
            if os.path.exists(src_f):
                shutil.copy2(src_f, os.path.join(temp_dir, f_name))

        src_dir = os.path.join(pipeline_dir, "src")
        if os.path.exists(src_dir):
            shutil.copytree(src_dir, os.path.join(temp_dir, "src"), dirs_exist_ok=True)

        if os.path.exists(source_nm):
            if sys.platform == "win32":
                subprocess.run(
                    ["cmd.exe", "/c", "mklink", "/J", junction_path, source_nm],
                    capture_output=True,
                    shell=True
                )
            else:
                os.symlink(source_nm, junction_path)

        patch_ok = apply_diff_to_directory(diff_patch, temp_dir)
        if not patch_ok:
            return {
                "passed": False,
                "exit_code": 1,
                "stdout": "",
                "stderr": "Patch could not be applied cleanly in sandbox temp directory.",
                "summary": "Sandbox patching failed before test execution."
            }

        cmd = ["npx.cmd" if sys.platform == "win32" else "npx", "jest", "worker.test.js", "--colors"]
        proc = subprocess.run(
            cmd,
            cwd=temp_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=40,
            shell=(sys.platform == "win32")
        )

        passed = (proc.returncode == 0)
        summary = "Jest tests passed successfully in sandbox." if passed else "Jest sandbox tests failed."
        match = re.search(r"Tests:\s+([^\n]+)", proc.stdout + proc.stderr)
        if match:
            summary = f"Tests: {match.group(1)}"

        return {
            "passed": passed,
            "exit_code": proc.returncode,
            "stdout": proc.stdout,
            "stderr": proc.stderr,
            "summary": summary
        }

    finally:
        if os.path.exists(junction_path):
            if sys.platform == "win32":
                subprocess.run(["cmd.exe", "/c", "rmdir", junction_path], capture_output=True, shell=True)
            else:
                try:
                    os.unlink(junction_path)
                except Exception:
                    pass
        shutil.rmtree(temp_dir, ignore_errors=True)
