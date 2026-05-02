#!/usr/bin/env python3
"""Write /tmp/ai-env.yaml or /tmp/api-env.yaml for gcloud run deploy --env-vars-file."""

from __future__ import annotations

import os
import sys


def yaml_double_quoted(value: str) -> str:
    escaped = str(value).replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def main() -> None:
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    if mode == "ai":
        pairs = [
            ("DATABASE_URL", "NEON_DATABASE_URL_AI"),
            ("GOOGLE_CLOUD_PROJECT", "GCP_PROJECT_ID"),
            ("GOOGLE_CLOUD_LOCATION", "GOOGLE_CLOUD_LOCATION"),
            ("EMBEDDING_MODEL", "EMBEDDING_MODEL"),
            ("CHAT_MODEL", "CHAT_MODEL"),
            ("TOP_K_CHUNKS", "TOP_K_CHUNKS"),
        ]
        out_path = "/tmp/ai-env.yaml"
    elif mode == "api":
        # Do not set PORT here: Cloud Run reserves PORT and injects it to match gcloud --port.
        pairs = [
            ("DATABASE_URL", "NEON_DATABASE_URL_API"),
            ("AI_BASE_URL", "AI_BASE_URL"),
            ("WEB_ORIGIN", "WEB_ORIGIN"),
        ]
        out_path = "/tmp/api-env.yaml"
    else:
        raise SystemExit("usage: gcp_run_env_yaml.py ai|api")

    lines: list[str] = []
    for yaml_key, env_key in pairs:
        raw = os.environ.get(env_key, "")
        if not raw:
            raise SystemExit(f"missing environment variable {env_key}")
        lines.append(f"{yaml_key}: {yaml_double_quoted(raw)}")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
