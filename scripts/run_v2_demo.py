from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.graph_v2 import compiled_graph_v2


def main():
    state = {
        "request_id": "demo-001",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "brand_name": "Sweetmore",
        "brand_description": "Warm fruit desserts brand; friendly, soft, minimal.",
        "brand_tone": "cozy",
        "target_usage": ["packaging", "instagram"],
        "regen_round": 0,
        "done": False,
    }

    out = compiled_graph_v2.invoke(state)
    safe = {
        k: v
        for k, v in out.items()
        if k
        in {
            "task_type",
            "enhanced_prompt",
            "candidate_images",
            "last_generated_image_url",
            "eval_score",
            "eval_feedback",
            "done",
        }
    }
    print(json.dumps(safe, ensure_ascii=False, indent=2, default=str))


if __name__ == "__main__":
    main()
