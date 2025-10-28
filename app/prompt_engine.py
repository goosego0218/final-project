from typing import Optional

from .config import client

SYSTEM_PROMPT = (
    "You are a senior logo prompt editor. You must preserve the structure and tone "
    "of the base prompt while applying minimal, localized edits requested by the user. "
    "Always return the full prompt in Markdown without extra commentary."
)


def _summarize_history(previous_changes: Optional[list[dict]]) -> str:
    if not previous_changes:
        return ""

    rows = []
    for change in previous_changes[-3:]:
        instruction = change.get("edit_instruction") or change.get("prompt") or ""
        stage = change.get("stage", "update")
        rows.append(f"- ({stage}) {instruction}".strip())
    if not rows:
        return ""
    return "[PREVIOUS CHANGES]\n" + "\n".join(rows) + "\n"


def refine_remix_prompt(
    base_prompt: str,
    edit_instruction: Optional[str],
    negative_prompt: Optional[str] = None,
    previous_changes: Optional[list[dict]] = None,
) -> str:
    if not edit_instruction:
        return base_prompt

    change_history = _summarize_history(previous_changes)
    parts = [
        "[BASE PROMPT]",
        base_prompt.strip(),
        "\n[EDIT INSTRUCTION]",
        edit_instruction.strip(),
    ]
    if change_history:
        parts.append("\n" + change_history.strip())

    guidance = (
        "Your task:\n"
        "1. Treat the base prompt as a finalized design brief.\n"
        "2. Only update sections that are relevant to the new instruction.\n"
        "3. Keep the structure (Typography, Color, Iconography, Layout, etc.) intact.\n"
        "4. Maintain semantic consistency so all sections align with a single brand vision.\n"
        "5. Reflect prior changes naturally so the evolution feels continuous.\n"
        "6. Return the complete prompt in Markdown without extra explanations.\n"
        "7. If a negative prompt exists, add a 'Constraints' section and list it.\n"
    )
    parts.append("\n" + guidance)

    if negative_prompt:
        parts.append("\n[NEGATIVE PROMPT]\n" + negative_prompt.strip())

    user_message = "\n".join(parts)

    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        temperature=0.3,
    )

    return completion.choices[0].message.content.strip()
