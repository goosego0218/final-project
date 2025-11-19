from __future__ import annotations

import requests
from fastapi import HTTPException
from langchain.tools import BaseTool
from pydantic import BaseModel, Field

from app.core.logo_settings import IDEOGRAM_API_KEY


def _require_api_key() -> str:
    if not IDEOGRAM_API_KEY:
        raise HTTPException(status_code=500, detail="IDEOGRAM_API_KEY is not configured.")
    return IDEOGRAM_API_KEY


def _post_json(url: str, headers: dict, json_payload: dict) -> dict:
    resp = requests.post(url, headers=headers, json=json_payload, timeout=90)
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    return resp.json()


def _post_multipart(url: str, headers: dict, data: dict, files: dict) -> dict:
    resp = requests.post(url, headers=headers, data=data, files=files, timeout=90)
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    return resp.json()


class IdeogramGenerateInput(BaseModel):
    prompt: str
    rendering_speed: str = "DEFAULT"
    negative_prompt: str | None = None
    aspect_ratio: str | None = None
    style_type: str | None = None
    style_preset: str | None = None
    seed: int | None = None


class IdeogramRemixInput(BaseModel):
    prompt: str
    image_bytes: bytes = Field(repr=False)
    rendering_speed: str = "DEFAULT"
    negative_prompt: str | None = None
    aspect_ratio: str | None = None
    style_type: str | None = None
    style_preset: str | None = None
    seed: int | None = None
    strength: float | None = None
    num_images: int | None = None


class IdeogramEditInput(BaseModel):
    prompt: str
    image_bytes: bytes = Field(repr=False)
    mask_bytes: bytes = Field(repr=False)
    rendering_speed: str = "DEFAULT"
    negative_prompt: str | None = None
    aspect_ratio: str | None = None
    style_type: str | None = None
    style_preset: str | None = None
    seed: int | None = None
    keep_background: bool | None = None
    edit_inpaint_strength: float | None = None


class IdeogramGenerateTool(BaseTool):
    name: str = "ideogram_generate"
    description: str = "Call Ideogram v3 generate endpoint"
    args_schema: type[BaseModel] = IdeogramGenerateInput

    def _run(self, **kwargs):
        api_key = _require_api_key()
        input_data = self.args_schema(**kwargs)
        payload = input_data.dict(exclude_none=True)
        headers = {"Api-Key": api_key}
        return _post_json("https://api.ideogram.ai/v1/ideogram-v3/generate", headers, payload)


class IdeogramRemixTool(BaseTool):
    name: str = "ideogram_remix"
    description: str = "Call Ideogram v3 remix endpoint"
    args_schema: type[BaseModel] = IdeogramRemixInput

    def _run(self, **kwargs):
        api_key = _require_api_key()
        input_data = self.args_schema(**kwargs)
        data = {
            "prompt": input_data.prompt,
            "rendering_speed": input_data.rendering_speed,
        }
        if input_data.negative_prompt:
            data["negative_prompt"] = input_data.negative_prompt
        if input_data.aspect_ratio:
            data["aspect_ratio"] = input_data.aspect_ratio
        if input_data.style_type:
            data["style_type"] = input_data.style_type
        if input_data.style_preset and not input_data.style_type:
            data["style_type"] = input_data.style_preset
        if input_data.seed is not None:
            data["seed"] = str(input_data.seed)
        if input_data.strength is not None:
            data["strength"] = str(input_data.strength)
        if input_data.num_images is not None:
            data["num_images"] = str(input_data.num_images)
        files = {
            "image": ("image.png", input_data.image_bytes, "image/png"),
        }
        headers = {"Api-Key": api_key}
        return _post_multipart("https://api.ideogram.ai/v1/ideogram-v3/remix", headers, data, files)


class IdeogramEditTool(BaseTool):
    name: str = "ideogram_edit"
    description: str = "Call Ideogram v3 edit endpoint"
    args_schema: type[BaseModel] = IdeogramEditInput

    def _run(self, **kwargs):
        api_key = _require_api_key()
        input_data = self.args_schema(**kwargs)
        data = {
            "prompt": input_data.prompt,
            "rendering_speed": input_data.rendering_speed,
        }
        if input_data.negative_prompt:
            data["negative_prompt"] = input_data.negative_prompt
        if input_data.aspect_ratio:
            data["aspect_ratio"] = input_data.aspect_ratio
        if input_data.style_type:
            data["style_type"] = input_data.style_type
        if input_data.style_preset and not input_data.style_type:
            data["style_type"] = input_data.style_preset
        if input_data.seed is not None:
            data["seed"] = str(input_data.seed)
        if input_data.keep_background is not None:
            data["keep_background"] = str(input_data.keep_background).lower()
        if input_data.edit_inpaint_strength is not None:
            data["edit_inpaint_strength"] = str(input_data.edit_inpaint_strength)
        files = {
            "image": ("image.png", input_data.image_bytes, "image/png"),
            "mask": ("mask.png", input_data.mask_bytes, "image/png"),
        }
        headers = {"Api-Key": api_key}
        return _post_multipart("https://api.ideogram.ai/v1/ideogram-v3/edit", headers, data, files)


class IdeogramReplaceBackgroundInput(BaseModel):
    prompt: str
    image_bytes: bytes = Field(repr=False)
    magic_prompt: str | None = "ON"
    rendering_speed: str = "DEFAULT"
    style_type: str | None = None
    style_preset: str | None = None
    seed: int | None = None
    num_images: int | None = None


class IdeogramReplaceBackgroundTool(BaseTool):
    name: str = "ideogram_replace_background"
    description: str = "Call Ideogram v3 replace-background endpoint"
    args_schema: type[BaseModel] = IdeogramReplaceBackgroundInput

    def _run(self, **kwargs):
        api_key = _require_api_key()
        input_data = self.args_schema(**kwargs)
        data = {
            "prompt": input_data.prompt,
            "rendering_speed": input_data.rendering_speed,
        }
        if input_data.magic_prompt:
            data["magic_prompt"] = input_data.magic_prompt
        if input_data.style_type:
            data["style_type"] = input_data.style_type
        elif input_data.style_preset:
            data["style_type"] = input_data.style_preset
        if input_data.seed is not None:
            data["seed"] = str(input_data.seed)
        if input_data.num_images is not None:
            data["num_images"] = str(input_data.num_images)
        files = {
            "image": ("image.png", input_data.image_bytes, "image/png"),
        }
        headers = {"Api-Key": api_key}
        return _post_multipart(
            "https://api.ideogram.ai/v1/ideogram-v3/replace-background",
            headers,
            data,
            files,
        )
