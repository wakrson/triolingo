import os

from openai import OpenAI

DEFAULT_MODEL = "meta-llama/Llama-3.1-8B-Instruct"
DEFAULT_BASE_URL = "https://router.huggingface.co/v1"

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = os.environ.get("HF_TOKEN") or os.environ.get("LLM_API_KEY")
        if not api_key:
            raise RuntimeError(
                "No LLM API key configured. Set HF_TOKEN (HuggingFace) or LLM_API_KEY in your environment."
            )
        base_url = os.environ.get("LLM_BASE_URL", DEFAULT_BASE_URL)
        _client = OpenAI(api_key=api_key, base_url=base_url)
    return _client


def _model() -> str:
    return os.environ.get("LLM_MODEL", DEFAULT_MODEL)


def call_llm(system: str, prompt: str, json_mode: bool = False) -> str:
    kwargs: dict = {
        "model": _model(),
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": 4096,
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    response = _get_client().chat.completions.create(**kwargs)
    return response.choices[0].message.content


def chat_llm(messages: list[dict]) -> str:
    response = _get_client().chat.completions.create(
        model=_model(),
        messages=messages,
        max_tokens=4096,
    )
    return response.choices[0].message.content
