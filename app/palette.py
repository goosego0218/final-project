import json
from typing import Any, Optional

from .config import client

PALETTE_SYSTEM_PROMPT = (
    "You are a brand identity color expert. "
    "Given brand details, you must recommend a cohesive color palette for a logo design. "
    "Respond with JSON containing either a preset palette name or explicit hex members."
)


def _normalize_members(raw_members: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for member in raw_members:
        color_hex = member.get("color_hex") or member.get("hex")
        if not color_hex or not isinstance(color_hex, str):
            continue
        color_hex = color_hex.strip()
        if not color_hex.startswith("#"):
            color_hex = f"#{color_hex}"
        color_hex = color_hex[:7]
        entry: dict[str, Any] = {"color_hex": color_hex}
        weight = member.get("color_weight") or member.get("weight")
        if isinstance(weight, (int, float)):
            entry["color_weight"] = max(0.05, min(1.0, float(weight)))
        normalized.append(entry)
    return normalized


def suggest_color_palette(
    brand_name: str,
    description: str,
    style: str,
) -> Optional[dict[str, Any]]:
    if not brand_name and not description and not style:
        return None

    user_message = (
        "Provide a color palette recommendation for the following logo brief.\n"
        f"Brand Name: {brand_name or 'N/A'}\n"
        f"Description: {description or 'N/A'}\n"
        f"Desired Style: {style or 'N/A'}\n\n"
        "Return JSON with either:\n"
        '{"name": "<palette_name>"} OR {"members": [{"color_hex": "#RRGGBB", "color_weight": 0.5}, ...]}.'
    )

    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": PALETTE_SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        temperature=0.4,
    )

    raw_content = completion.choices[0].message.content
    if not raw_content:
        return None

    try:
        data = json.loads(raw_content)
    except json.JSONDecodeError:
        return None

    if isinstance(data, dict):
        if "name" in data and isinstance(data["name"], str) and data["name"].strip():
            return {"name": data["name"].strip().upper()}
        if "members" in data and isinstance(data["members"], list):
            members = _normalize_members(data["members"])
            if members:
                return {"members": members}
    return None
