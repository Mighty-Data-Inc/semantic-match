# json-surgery

Iterative, AI-guided JSON modification powered by OpenAI. Pass in any JSON-compatible object and natural-language instructions; the package breaks the task into discrete atomic operations (assign, delete, append, insert, rename) that are verified and applied one by one until the object satisfies your instructions.

This repo contains cross-language implementations from **Mighty Data Inc.** that can be dropped straight into real projects.

## Design goals

* Minimal abstractions
* Predictable behavior
* Cross-language parity (Python + TypeScript)
* Easy to drop into real projects

Rather than asking an LLM to rewrite an entire JSON blob in one shot (which is error-prone for large or complex structures), `json_surgery` / `jsonSurgery` decomposes the task into small, verifiable steps, gives the model feedback after each one, and iterates until validation passes.

## Packages

- TypeScript: `@mightydatainc/json-surgery` (npm) in `packages/typescript-json-surgery`
- Python: `mightydatainc-json-surgery` (PyPI, import as `mightydatainc_json_surgery`) in `packages/python-json-surgery`

Package-specific docs:

- TypeScript: [packages/typescript-json-surgery/README.md](packages/typescript-json-surgery/README.md)
- Python: [packages/python-json-surgery/README.md](packages/python-json-surgery/README.md)

## Feature overview

Core capabilities (Python + TypeScript):

- `json_surgery` / `jsonSurgery` — iteratively modifies a JSON object via LLM-guided atomic operations
- `placemarked_json_stringify` / `placemarkedJSONStringify` — serializes JSON with inline path comments for model readability
- `navigate_to_json_path` / `navigateToJSONPath` — traverses a JSON object by a path list
- Validation callback (`on_validate_before_return` / `onValidateBeforeReturn`) for custom schema enforcement
- Progress callback (`on_work_in_progress` / `onWorkInProgress`) for monitoring and mid-process intervention
- Configurable time and iteration limits with `JSONSurgeryError` carrying the last known object state

## Quick start

### Python

```python
from openai import OpenAI
from mightydatainc_json_surgery import json_surgery

client = OpenAI()

result = json_surgery(
    openai_client=client,
    obj={"title": "Draft", "items": [{"id": 1, "status": "draft"}]},
    modification_instructions='Set the status of every item to "published".',
)
print(result)
```

### TypeScript

```ts
import OpenAI from 'openai';
import { jsonSurgery } from '@mightydatainc/json-surgery';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const result = await jsonSurgery(
  client,
  { title: 'Draft', items: [{ id: 1, status: 'draft' }] },
  'Set the status of every item to "published".'
);
console.log(result);
```

## Local dev (Windows)

### Python

From `packages/python-json-surgery`, activate the package venv and run tests:

```powershell
.\.venv\Scripts\Activate.ps1
python -m pytest tests/ -v
```

Live integration tests (real API) require `OPENAI_API_KEY` in your environment.

### TypeScript

From `packages/typescript-json-surgery`, install dependencies and run tests/build:

```powershell
npm ci
npm test
npm run build
```

## Unit testing with live API calls

Some tests intentionally call the real OpenAI API instead of mocking model responses.

This is by design: the core contract includes prompt wording, output parsing, and model behavior working together. Mock-only tests cannot verify whether production prompts still elicit the required structured output.

These tests do have tradeoffs:

- They require `OPENAI_API_KEY` in the test environment.
- They incur a small API cost when run.
- They can be slower than pure unit tests.

Deterministic assertions are still intentional here: tests are written with tightly scoped instructions and clearly defined JSON outcomes, so stable structured output is treated as a baseline requirement. If those tests fail, we treat it as a bug in prompt design, output handling, or integration behavior.

## Release process

This repo ships two public packages with aligned versions:

- npm: `@mightydatainc/json-surgery` from `packages/typescript-json-surgery`
- PyPI: `mightydatainc-json-surgery` from `packages/python-json-surgery`

GitHub release automation publishes each package automatically on push to `main`
when its package version changes:

- TypeScript checks `packages/typescript-json-surgery/package.json`
- Python checks `packages/python-json-surgery/pyproject.toml`

Before publishing, ensure both versions are updated (`package.json` and `pyproject.toml`), then authenticate once locally:

- npm: `npm login`
- PyPI: configure `~/.pypirc` or use `python -m twine upload --repository pypi dist/*`

After publish, tag and push a release tag (example):

```powershell
git tag v1.1.1
git push origin v1.1.1
```
