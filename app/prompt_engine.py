from typing import Optional

from .config import client


def refine_remix_prompt(
    base_prompt: str,
    edit_instruction: Optional[str],
    negative_prompt: Optional[str] = None,
    previous_changes: Optional[list[dict]] = None,
) -> str:
    if not edit_instruction:
        return base_prompt

    change_history = ""
    if previous_changes:
        summarized = "\n".join(
            [f"- {c.get('edit_instruction', '')}" for c in previous_changes[-3:]]
        )
        change_history = f"[PREVIOUS CHANGES]\n{summarized}\n"

    user_message = f"""
            [BASE PROMPT]
            {base_prompt.strip()}

            [EDIT INSTRUCTION]
            {edit_instruction.strip()}

            {change_history}

            Your task:
            1. Treat the BASE PROMPT as a finalized, structured design brief.
            2. Only update or add content related to the EDIT INSTRUCTION.
            3. Keep the structure (Typography, Color, Iconography, Layout, etc.) intact.
            4. Ensure **semantic consistency** across all sections — typography, color, and iconography
            should harmonize in tone, energy, and mood as part of one cohesive brand concept.
            5. Reflect **previous changes** naturally so the evolution feels continuous,
            not like separate revisions.
            6. Maintain the tone and language style of the base prompt (English, Markdown structured).
            7. Return the full updated prompt text (including unmodified sections).
            8. Append a “Constraints” section if a NEGATIVE PROMPT exists.
                """

    if negative_prompt:
        user_message += f"\n[NEGATIVE PROMPT]\n{negative_prompt.strip()}"

    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a senior logo prompt editor. "
                    "You must preserve the base structure and style of the logo brief. "
                    "Apply localized edits while maintaining semantic consistency across sections. "
                    "Incorporate prior change context to create smooth, iterative evolution. "
                    "Return the final structured prompt in Markdown, no explanations."
                ),
            },
            {"role": "user", "content": user_message},
        ],
        temperature=0.3,
    )

    return completion.choices[0].message.content.strip()
