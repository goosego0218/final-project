# Agent Notes and Shared State

Purpose: document the core shared state and node I/O so multiple agents (and humans) can coordinate. Also records recent refactors for quick onboarding.

## Recent Changes
- Removed unused modules: `app/palette.py`, `app/prompt_engine.py`, `app/utils.py`.
- Removed palette support across code (state, request model, and API response): no `color_palette` or `enable_palette_suggestion`.
- Cleaned unused imports in `app/nodes_v2.py` and dropped the backward‑compat alias `compiled_graph` in `app/graph_v2.py`.
- Added structured logo‑library endpoint `/logo_library` backed by `data/processed/logos/structured/*.json` to serve type/style examples for UI narrowing.
- Extended `LogoState` with `logo_type`, `style_preferences`, `trend_highlights`, and `reference_logo` so UI selections/refs survive across nodes. `image_operator_node` now folds these cues into prompts and auto-upgrades GENERATE→REMIX when a reference image is present.
- Streamlit 프런트는 타입→스타일→레퍼런스 선택 플로우로 교체되었고, `/logo_library` 또는 `app.library` 데이터를 토대로 예시 이미지를 보여줍니다. 새 필드(`logo_type`, `style_preferences`, `trend_highlights`, `reference_logo`)가 API 요청 (`LogoRequest`)에도 노출됩니다.
- Streamlit에 마스크 편집 섹션이 복원되어 최근 생성 이미지 위에 핑크색 브러시로 영역을 지정하고 Ideogram EDIT 플로우를 호출할 수 있습니다. 저장된 마스크는 `data/outputs/user_mask_*.png`에 위치합니다.

## Core State: `LogoState`
Source: `app/agent_schema.py:32`

High‑level groups:
- Request meta: `request_id`, `created_at`, `updated_at`
- User context: `brand_name`, `brand_description`, `brand_tone`, `target_usage`, `logo_type`, `style_preferences`, `trend_highlights`
- Task routing: `task_type`, `input_image_urls`, `input_mask_url`
- Prompt planning: `enhanced_prompt`, `negative_prompt`, `style_tags`, `style_preset`, `style_type`, `rendering_speed`, `aspect_ratio`, `seed`
- Image results: `candidate_images`, `last_generated_image_url`, `is_image_safe`, `reference_logo`
- Evaluation/feedback: `eval_score`, `eval_feedback`, `human_feedback`, `next_prompt_hint`, `regen_round`
- Completion: `done`
- Debug/trace (optional): `task_reason`, `api_endpoint`, `mask_source`, `mask_size`, `image_operator_error`

Notes:
- Palette fields were removed; if palette returns in the future, add as a separate optional key space to avoid breaking agents.
- Prefer `style_type` for Ideogram; `style_preset` remains as a compatibility fallback.
- Library endpoint `/logo_library` returns cached records with `logo_type`/`style_tags`/image path so the UI can progressively narrow options without re-processing the dataset. Use `?refresh=true` to rebuild cache after updating `data/processed/logos/structured`.

## Node I/O Contracts (Pydantic)
Source: `app/agent_schema.py`

- IntentRouterIn/Out: (`:91`, `:97`) Minimal text/images in, emits `task_type`.
- PromptPlannerIn/Out: (`:101`, `:111`) Brand context in, emits `enhanced_prompt` (+options).
- ImageOperatorIn/Out: (`:130`, `:142`) Model request in, emits candidate URLs and last image URL.
- EvaluatorIn/Out: (`:148`, `:155`) Image and context in, emits score/feedback and next prompt hint.
- ResultPackagerOut: (`:162`) Finalization signal with chosen image URL and optional history.

These classes define the intended boundaries for each node. The current `nodes_v2` implementation primarily uses the shared `LogoState`, but the I/O models describe the expected shape when/if nodes are isolated or tested individually.

## Orchestration
- Graph builder: `app/graph_v2.py:26` → `build_graph_v2()` sets nodes and edges.
- Compiled graph: `app/graph_v2.py:76` → `compiled_graph_v2`.
- API entrypoint: `app/main.py:12` FastAPI app and `/logo_pipeline` uses `compiled_graph_v2` and returns the legacy keys needed by the Streamlit frontend.

## Feedback Requests (Mentor / Agents)
1) State surface: Are the Prompt planning keys sufficient (`enhanced_prompt`, `negative_prompt`, `style_type/preset`, `aspect_ratio`, `seed`)? Any missing constraints we should standardize?
2) Task routing: Is the heuristic in `choose_task_type` adequate for distinguishing remix/edit/describe? Any additional cues to promote/demote?
3) Node I/O: Do we keep the Pydantic I/O models as canonical contracts for isolated testing, or simplify to pure `LogoState` transitions?
4) Result packaging: Minimal data currently returned to the client; confirm any additional metadata we should persist (e.g., safety flags, history snapshots).
5) Naming: Confirm we standardize on `style_type` as the external control and retain `style_preset` only as a compatibility alias.
6) Extensibility: If palette returns, prefer a new optional `design_guidance` bundle over re‑adding top‑level `color_palette` to keep the state flatter.

## Conventions
- Keep nodes pure: accept/return partial `LogoState` deltas; avoid side effects where possible.
- Validate externally visible values at boundaries (API request model, node I/O).
- Keep imports minimal in node modules; unused imports should be pruned during review.
