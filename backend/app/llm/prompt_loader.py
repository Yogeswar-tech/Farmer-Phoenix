"""Loader for versioned markdown prompt files and shared fragments."""

from pathlib import Path
from typing import Any

BASE_DIR = Path(__file__).resolve().parents[2]
PROMPTS_ROOT = BASE_DIR / "prompts" if (BASE_DIR / "prompts").exists() else Path("prompts")
SHARED_ROOT = PROMPTS_ROOT / "_shared"


def load_prompt(
    feature: str,
    name: str,
    version: int = 1,
    variables: dict[str, Any] | None = None,
) -> str:
    """Load a versioned prompt template from disk and inject shared fragments and variables.

    Args:
        feature: Subdirectory under prompts/ (e.g. 'price')
        name: Prompt file basename (e.g. 'advisor')
        version: Version number (e.g. 1 -> advisor.v1.md)
        variables: Dictionary of string replacements for {{variable_name}}
    """
    prompt_file = PROMPTS_ROOT / feature / f"{name}.v{version}.md"
    if not prompt_file.exists():
        raise FileNotFoundError(f"Prompt file not found: {prompt_file}")

    with open(prompt_file, encoding="utf-8") as f:
        template = f.read()

    # 1. Resolve shared fragments (e.g. {{grounding_policy}})
    if "{{grounding_policy}}" in template:
        shared_policy_file = SHARED_ROOT / "grounding_policy.v1.md"
        if shared_policy_file.exists():
            with open(shared_policy_file, encoding="utf-8") as pf:
                policy_text = pf.read()
            template = template.replace("{{grounding_policy}}", policy_text)
        else:
            template = template.replace("{{grounding_policy}}", "")

    # 2. Inject caller variables
    if variables:
        for key, value in variables.items():
            placeholder = f"{{{{{key}}}}}"
            template = template.replace(placeholder, str(value))

    return template
