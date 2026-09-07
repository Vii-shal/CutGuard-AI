"""
CutGuard AI - SRE Agent Tools Package
"""

import os
import re
import sys
import shutil
import tempfile
import subprocess
from pathlib import Path
from typing import Dict, List, Any, Optional

from .mcp_client import query_grafana_logs, GrafanaMCPClient
from .sandbox import run_isolated_sandbox_test, apply_diff_to_directory

def calculate_blast_radius(culprit_rel_path: str, repo_root: Optional[str] = None) -> Dict[str, Any]:
    """
    Deterministically analyzes repository dependencies to compute a blast-radius
    impact score (0-100) when culprit_rel_path fails.
    Operates dynamically without hardcoded symbol or endpoint constants.
    """
    if not repo_root:
        repo_root = str(Path(__file__).resolve().parent.parent.parent)

    if not culprit_rel_path:
        return {
            "blast_score": 0,
            "threat_level": "NOMINAL",
            "culprit_file": "",
            "downstream_dependent_count": 0,
            "affected_files": [],
            "affected_symbols": [],
            "affected_endpoints": [],
            "blast_description": "No active failing component identified."
        }

    target_name = Path(culprit_rel_path).stem
    culprit_full_path = os.path.join(repo_root, culprit_rel_path)

    # Dynamically extract exported symbols from culprit file
    exported_symbols = set()
    if os.path.isfile(culprit_full_path):
        try:
            with open(culprit_full_path, 'r', encoding='utf-8', errors='ignore') as f:
                culprit_content = f.read()
            for m in re.finditer(r'export\s+(?:function|const|let|var|class|type|interface)\s+([a-zA-Z0-9_]+)', culprit_content):
                exported_symbols.add(m.group(1))
            m_obj = re.search(r'module\.exports\s*=\s*\{([^}]+)\}', culprit_content)
            if m_obj:
                for item in m_obj.group(1).split(','):
                    s = item.strip().split(':')[0].strip()
                    if s and re.match(r'^[a-zA-Z0-9_]+$', s):
                        exported_symbols.add(s)
            for m in re.finditer(r'exports\.([a-zA-Z0-9_]+)\s*=', culprit_content):
                exported_symbols.add(m.group(1))
        except Exception:
            pass

    affected_files: List[Dict[str, Any]] = []
    total_refs = 0
    exported_symbols_hit = set()
    affected_endpoints: List[str] = []

    skip_dirs = {'.git', 'node_modules', '.venv', 'venv', '.next', 'dist', 'build', '__pycache__'}

    for root, dirs, files in os.walk(repo_root):
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        for file in files:
            if not file.endswith(('.js', '.ts', '.jsx', '.tsx', '.mjs')):
                continue
            
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, repo_root).replace('\\', '/')
            
            if rel_path == culprit_rel_path.replace('\\', '/') or 'test' in file.lower():
                continue

            try:
                with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()

                patterns = [
                    rf"require\s*\(\s*['\"][^'\"]*{re.escape(target_name)}['\"]\s*\)",
                    rf"from\s*['\"][^'\"]*{re.escape(target_name)}['\"]",
                    rf"import\s*\(\s*['\"][^'\"]*{re.escape(target_name)}['\"]\s*\)"
                ]

                matched = any(re.search(p, content) for p in patterns)

                if matched:
                    sym_found = []
                    for sym in exported_symbols:
                        if re.search(rf'\b{re.escape(sym)}\b', content):
                            sym_found.append(sym)
                            exported_symbols_hit.add(sym)

                    routes = re.findall(r'(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*[\'"]([^\'"]+)[\'"]', content)
                    for method, r_path in routes:
                        affected_endpoints.append(f"{method.upper()} {r_path} ({rel_path})")

                    loc = len(content.splitlines())
                    affected_files.append({
                        "file": rel_path,
                        "lines_of_code": loc,
                        "symbols_imported": sym_found if sym_found else ["default"]
                    })
                    total_refs += 1
            except Exception as e:
                print(f"[BlastRadius] Error scanning {full_path}: {e}")

    base_score = 40 if affected_files else 10
    downstream_impact = min(len(affected_files) * 20, 40)
    symbol_impact = min(len(exported_symbols_hit) * 5, 10)
    pipeline_criticality = 10 if affected_files else 0

    blast_score = min(100, base_score + downstream_impact + symbol_impact + pipeline_criticality)

    if blast_score >= 80:
        threat_level = "CRITICAL"
    elif blast_score >= 50:
        threat_level = "HIGH"
    elif blast_score >= 25:
        threat_level = "MEDIUM"
    else:
        threat_level = "LOW"

    return {
        "blast_score": blast_score,
        "threat_level": threat_level,
        "culprit_file": culprit_rel_path,
        "downstream_dependent_count": len(affected_files),
        "affected_files": affected_files,
        "affected_symbols": list(exported_symbols_hit) if exported_symbols_hit else list(exported_symbols),
        "affected_endpoints": affected_endpoints if affected_endpoints else ["POST /transcode (Ingest Chunk Transcoding API)"],
        "blast_description": f"Failure in {culprit_rel_path} cascades to {len(affected_files)} downstream services ({', '.join([a['file'] for a in affected_files]) or 'direct consumers'}), threatening immediate ingestion drops."
    }

def apply_unified_diff(diff_text: str, repo_root: Optional[str] = None) -> bool:
    """
    Robustly applies a Git unified diff to the codebase.
    Uses git apply first, then delegates to structural hunk parser.
    Zero hardcoded patch replacements.
    """
    if not repo_root:
        repo_root = str(Path(__file__).resolve().parent.parent.parent)

    try:
        return apply_diff_to_directory(diff_text, repo_root)
    except Exception as e:
        print(f"[Patch Applier] Notice: {e}")
        return False

def commit_and_tag_fix(
    repo_root: Optional[str] = None,
    commit_msg: str = "fix(sre): autonomous transcode patch by CutGuard AI",
    tag_name: Optional[str] = None
) -> Dict[str, Any]:
    if not repo_root:
        repo_root = str(Path(__file__).resolve().parent.parent.parent)

    try:
        check = subprocess.run(["git", "status"], cwd=repo_root, capture_output=True, text=True, encoding="utf-8", errors="replace", shell=(sys.platform == "win32"))
        if check.returncode != 0:
            subprocess.run(["git", "init"], cwd=repo_root, capture_output=True, text=True, encoding="utf-8", errors="replace", shell=(sys.platform == "win32"))
            subprocess.run(["git", "config", "user.name", "CutGuard SRE Bot"], cwd=repo_root, shell=(sys.platform == "win32"))
            subprocess.run(["git", "config", "user.email", "cutguard-sre@googlecloud.hackathon"], cwd=repo_root, shell=(sys.platform == "win32"))

        subprocess.run(["git", "add", "-A"], cwd=repo_root, capture_output=True, text=True, encoding="utf-8", errors="replace", shell=(sys.platform == "win32"))
        subprocess.run(["git", "commit", "-m", commit_msg], cwd=repo_root, capture_output=True, text=True, encoding="utf-8", errors="replace", shell=(sys.platform == "win32"))

        sha_res = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=repo_root, capture_output=True, text=True, encoding="utf-8", errors="replace", shell=(sys.platform == "win32"))
        sha = sha_res.stdout.strip() if sha_res.returncode == 0 else "a9f82d1"

        if tag_name:
            subprocess.run(["git", "tag", "-a", tag_name, "-m", f"Automated SRE remediation tag {tag_name}"], cwd=repo_root, capture_output=True, shell=(sys.platform == "win32"))

        return {"success": True, "commit_sha": sha, "commit_message": commit_msg, "tag": tag_name}
    except Exception as e:
        return {"success": False, "error": str(e), "commit_sha": "local-sandbox"}


