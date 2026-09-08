"""
CutGuard AI - Resilient Gemini Key Manager
Provides comma-separated key pooling, automatic 429/RESOURCE_EXHAUSTED failover,
cooldown tracking, and health check observability.
"""

import os
import re
import time
from typing import Optional, List, Dict, Any, Tuple
from pathlib import Path
from dotenv import load_dotenv

try:
    from google import genai
    GENAI_AVAILABLE = True
except ImportError:
    genai = None
    GENAI_AVAILABLE = False


def mask_key(key: str) -> str:
    """Safely masks an API key for logs and public health endpoints."""
    if not key:
        return "none"
    clean = key.strip().strip("'\"")
    if len(clean) >= 10:
        return f"{clean[:6]}...{clean[-4:]}"
    elif len(clean) >= 4:
        return f"{clean[:2]}...{clean[-2:]}"
    return "***"


def is_rate_limit_error(err: Any) -> bool:
    """Detects 429, RESOURCE_EXHAUSTED, or quota exceeded errors."""
    err_str = str(err).lower()
    return any(marker in err_str for marker in [
        "429",
        "resource_exhausted",
        "quota",
        "rate limit",
        "ratelimit",
        "exhausted",
        "too many requests"
    ])


def is_transient_server_error(err: Any) -> bool:
    """Detects 503 UNAVAILABLE, high demand spikes, or transient service disruptions."""
    err_str = str(err).lower()
    return any(marker in err_str for marker in [
        "503",
        "unavailable",
        "high demand",
        "overloaded",
        "service unavailable",
        "temporarily unavailable",
        "try again later"
    ])


def is_auth_error(err: Any) -> bool:
    """Detects invalid API key or permission errors."""
    err_str = str(err).lower()
    return any(marker in err_str for marker in [
        "api_key_invalid",
        "api key not valid",
        "invalid api key",
        "unauthenticated",
        "permission_denied",
        "forbidden"
    ])


def sanitize_error(err: Any) -> str:
    """Transforms raw SDK exceptions into clean diagnostic text."""
    err_str = str(err)
    if is_rate_limit_error(err):
        return "Gemini API rate limit / daily quota reached (429 RESOURCE_EXHAUSTED)."
    if is_transient_server_error(err):
        return "Gemini API temporarily unavailable due to high demand (503 UNAVAILABLE)."
    if is_auth_error(err):
        return "Gemini API authentication failed (invalid or expired key)."
    first_line = err_str.split("\n")[0].strip()
    return first_line[:140]


class KeySlot:
    """Represents a single Gemini API key with runtime status and metrics."""

    def __init__(self, key: str, index: int):
        self.key: str = key
        self.index: int = index  # 0-based
        self.masked: str = mask_key(key)
        self.client: Optional[Any] = None
        self.cooldown_until: float = 0.0
        self.last_error: Optional[str] = None
        self.success_count: int = 0
        self.fail_count: int = 0
        self.auth_failed: bool = False

    def is_cooling_down(self) -> bool:
        return time.time() < self.cooldown_until

    def cooldown_remaining(self) -> int:
        remaining = int(self.cooldown_until - time.time())
        return max(0, remaining)

    def mark_cooldown(self, duration_sec: float = 300.0, reason: str = ""):
        self.cooldown_until = time.time() + duration_sec
        self.fail_count += 1
        self.last_error = reason or "Rate limited / quota exhausted (429)"

    def mark_auth_error(self, reason: str = ""):
        self.auth_failed = True
        self.cooldown_until = time.time() + 86400.0  # 24h quarantine for bad keys
        self.fail_count += 1
        self.last_error = reason or "Authentication failed (invalid key)"

    def mark_success(self):
        self.success_count += 1
        self.last_error = None
        self.cooldown_until = 0.0

    def get_client(self) -> Optional[Any]:
        if not GENAI_AVAILABLE:
            return None
        if self.client is None and self.key:
            try:
                self.client = genai.Client(api_key=self.key)
            except Exception as e:
                self.last_error = f"Client init error: {e}"
                print(f"[Gemini Key Manager] Error initializing client for Key #{self.index + 1}: {e}")
                return None
        return self.client

    def status_summary(self, is_active: bool) -> Dict[str, Any]:
        if self.auth_failed:
            status = "auth_error"
        elif self.is_cooling_down():
            status = "cooldown"
        elif is_active:
            status = "active"
        else:
            status = "ready"

        return {
            "index": self.index + 1,  # 1-based index for human readability
            "preview": self.masked,
            "status": status,
            "is_active": is_active,
            "cooldown_remaining_sec": self.cooldown_remaining(),
            "success_count": self.success_count,
            "fail_count": self.fail_count,
            "last_error": self.last_error
        }


class GeminiKeyManager:
    """
    Manages a pool of Gemini API keys configured via GEMINI_API_KEY.
    Supports single key or comma-separated keys (e.g. key1,key2,key3).
    Automatically fails over upon encountering 429 / RESOURCE_EXHAUSTED.
    """

    def __init__(self, cooldown_duration_sec: float = 300.0):
        self.cooldown_duration_sec: float = cooldown_duration_sec
        self.slots: List[KeySlot] = []
        self.active_index: int = 0
        self.last_global_error: Optional[str] = None
        self._raw_env_keys: str = ""
        self.reload_keys()

    @property
    def total_keys(self) -> int:
        return len(self.slots)

    def has_keys(self) -> bool:
        return len(self.slots) > 0

    def has_available_keys(self) -> bool:
        return any(not s.is_cooling_down() and not s.auth_failed for s in self.slots)

    def reload_keys(self):
        """Loads or refreshes keys from environment variable or .env."""
        raw = os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_API_KEYS") or ""
        if not raw:
            env_path = Path(__file__).resolve().parent / ".env"
            if env_path.exists():
                load_dotenv(env_path, override=True)
                raw = os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_API_KEYS") or ""

        raw_clean = raw.strip().strip("'\"")
        if raw_clean == self._raw_env_keys and self.slots:
            return

        self._raw_env_keys = raw_clean
        # Split on comma or semicolon
        tokens = [k.strip().strip("'\"") for k in re.split(r"[,;]", raw_clean) if k.strip().strip("'\"")]

        # Deduplicate while maintaining user configuration order
        seen = set()
        keys = []
        for k in tokens:
            if k not in seen:
                seen.add(k)
                keys.append(k)

        # Preserve state and metrics for keys already in the slot list
        existing_slots = {s.key: s for s in self.slots}
        new_slots = []
        for idx, k in enumerate(keys):
            if k in existing_slots:
                slot = existing_slots[k]
                slot.index = idx
                new_slots.append(slot)
            else:
                new_slots.append(KeySlot(key=k, index=idx))

        self.slots = new_slots
        if self.active_index >= len(self.slots):
            self.active_index = 0

        if self.slots:
            active_preview = self.slots[self.active_index].masked
            print(f"[Gemini Key Manager] Loaded {len(self.slots)} key(s). Active Key: #{self.active_index + 1} ({active_preview})")
        else:
            print("[Gemini Key Manager] Warning: No GEMINI_API_KEY found in environment or .env.")

    def get_active_slot(self) -> Optional[KeySlot]:
        """Returns the current active slot, rotating forward if in cooldown or auth error."""
        if not self.slots:
            self.reload_keys()
            if not self.slots:
                return None

        # Check current active slot
        active = self.slots[self.active_index]
        if not active.is_cooling_down() and not active.auth_failed:
            return active

        # Rotate cyclically to find the next ready slot
        n = len(self.slots)
        for offset in range(1, n):
            idx = (self.active_index + offset) % n
            candidate = self.slots[idx]
            if not candidate.is_cooling_down() and not candidate.auth_failed:
                self.active_index = idx
                print(f"[Gemini Key Manager] Active key rotated to Key #{self.active_index + 1} ({candidate.masked})")
                return candidate

        return None

    def get_active_client(self) -> Optional[Any]:
        """Returns the genai.Client instance for the currently active key."""
        slot = self.get_active_slot()
        if slot:
            return slot.get_client()
        # If all in cooldown, return the client of the slot that will expire earliest
        earliest = self.get_earliest_cooling_slot()
        if earliest:
            return earliest.get_client()
        return None

    def get_earliest_cooling_slot(self) -> Optional[KeySlot]:
        cooling = [s for s in self.slots if not s.auth_failed]
        if not cooling:
            return None
        return min(cooling, key=lambda s: s.cooldown_until)

    def generate_content(
        self,
        contents: Any,
        candidate_models: Optional[List[str]] = None,
        **kwargs
    ) -> Tuple[Optional[Any], Optional[str]]:
        """
        Executes generate_content across the key pool with automatic 429 failover.
        When Key 1 hits 429 or RESOURCE_EXHAUSTED, marks Key 1 as temporarily cooled down
        and instantly retries the request with Key 2, then Key 3.

        Returns: (response, error_message)
        """
        if not GENAI_AVAILABLE:
            err = "google-genai package is not installed (ImportError)."
            self.last_global_error = err
            return None, err

        if not self.slots:
            self.reload_keys()
            if not self.slots:
                err = "GEMINI_API_KEY is not configured in environment or .env."
                self.last_global_error = err
                return None, err

        if not candidate_models:
            candidate_models = [
                os.getenv("GEMINI_MODEL", "gemini-3.6-flash"),
                "gemini-3.8-flash",
                "gemini-3.5-flash",
                "gemini-3.7-flash",
                "gemini-flash-latest"
            ]

        # Deduplicate model list while preserving preference order
        models = []
        for m in candidate_models:
            if m and m not in models:
                models.append(m)

        attempted_indices = set()
        last_error_msg = None

        while len(attempted_indices) < len(self.slots):
            slot = self.get_active_slot()
            if not slot:
                # All keys in cooldown
                earliest = self.get_earliest_cooling_slot()
                wait_sec = earliest.cooldown_remaining() if earliest else 300
                last_error_msg = f"All {len(self.slots)} Gemini API keys are quota exhausted (429 RESOURCE_EXHAUSTED). Next key available in ~{wait_sec}s."
                self.last_global_error = last_error_msg
                print(f"[Gemini Key Manager] {last_error_msg}")
                return None, last_error_msg

            if slot.index in attempted_indices:
                # All available ready keys have been attempted in this request
                break

            attempted_indices.add(slot.index)
            client = slot.get_client()
            if not client:
                slot.mark_auth_error("Failed to initialize genai client")
                continue

            key_hit_rate_limit = False
            for model_name in models:
                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=contents,
                        **kwargs
                    )
                    # Successful generation!
                    slot.mark_success()
                    self.last_global_error = None
                    print(f"[Gemini Key Manager] Success with Key #{slot.index + 1} ({slot.masked}) using model {model_name}")
                    return response, None

                except Exception as model_err:
                    clean_err = sanitize_error(model_err)
                    last_error_msg = clean_err
                    print(f"[Gemini Key Manager] Key #{slot.index + 1} ({slot.masked}) model {model_name} error: {clean_err}")

                    if is_rate_limit_error(model_err):
                        # Quota exhausted on this key! Mark cooled down and fail over instantly
                        slot.mark_cooldown(duration_sec=self.cooldown_duration_sec, reason=clean_err)
                        print(f"[Gemini Key Manager] [Failover] Key #{slot.index + 1} ({slot.masked}) hit 429/RESOURCE_EXHAUSTED. Cooling down for {int(self.cooldown_duration_sec)}s. Instantly failing over to next key...")
                        key_hit_rate_limit = True
                        break  # Break inner model loop to switch key immediately!

                    elif is_transient_server_error(model_err):
                        # High demand / 503 error on this model! Try immediate backoff retry once, then failover to next model
                        print(f"[Gemini Key Manager] [Transient 503] Model {model_name} on Key #{slot.index + 1} ({slot.masked}) reported high demand. Retrying after 1.5s backoff...")
                        time.sleep(1.5)
                        try:
                            response = client.models.generate_content(
                                model=model_name,
                                contents=contents,
                                **kwargs
                            )
                            slot.mark_success()
                            self.last_global_error = None
                            print(f"[Gemini Key Manager] Backoff retry succeeded with Key #{slot.index + 1} ({slot.masked}) using model {model_name}")
                            return response, None
                        except Exception as retry_err:
                            clean_retry_err = sanitize_error(retry_err)
                            print(f"[Gemini Key Manager] Model {model_name} retry also failed: {clean_retry_err}. Failing over to next candidate model...")
                            slot.last_error = clean_retry_err
                            continue

                    elif is_auth_error(model_err):
                        slot.mark_auth_error(clean_err)
                        print(f"[Gemini Key Manager] [Failover] Key #{slot.index + 1} ({slot.masked}) authentication failed. Failing over to next key...")
                        key_hit_rate_limit = True
                        break  # Break inner model loop to switch key immediately!

                    else:
                        # Model-specific or transient error, continue trying next candidate model with same key
                        slot.last_error = clean_err
                        continue

            if not key_hit_rate_limit:
                slot.fail_count += 1
                slot.last_error = last_error_msg

        self.last_global_error = last_error_msg or "All Gemini API keys failed."
        return None, self.last_global_error

    def get_health_status(self) -> Dict[str, Any]:
        """
        Returns full observability details into key pool health:
        - How many keys are loaded
        - Which key is active
        - Cooldown status and success/fail counts for each key
        """
        self.reload_keys()
        total_keys = len(self.slots)
        active_slot = self.get_active_slot()

        if active_slot:
            active_idx = active_slot.index + 1
            active_preview = active_slot.masked
            active_len = len(active_slot.key)
        elif self.slots:
            active_idx = self.active_index + 1
            active_preview = self.slots[self.active_index].masked
            active_len = len(self.slots[self.active_index].key)
        else:
            active_idx = 0
            active_preview = "none"
            active_len = 0

        available_count = sum(1 for s in self.slots if not s.is_cooling_down() and not s.auth_failed)

        if total_keys == 0:
            gemini_api_status = "missing_key"
        elif available_count > 0:
            gemini_api_status = "active"
        else:
            gemini_api_status = "all_cooling_down"

        keys_status_list = [
            s.status_summary(is_active=(active_slot is not None and s.index == active_slot.index))
            for s in self.slots
        ]

        return {
            "gemini_api": gemini_api_status,
            "genai_sdk_installed": GENAI_AVAILABLE,
            "client_initialized": active_slot is not None,
            "total_keys": total_keys,
            "keys_loaded": total_keys,
            "active_key_index": active_idx,
            "active_key_preview": active_preview,
            "available_keys_count": available_count,
            "keys_status": keys_status_list,
            "last_gemini_error": self.last_global_error or (active_slot.last_error if active_slot else None),
            "key_length": active_len,
            "key_preview": active_preview
        }


# Global singleton manager instance
gemini_key_manager = GeminiKeyManager()
