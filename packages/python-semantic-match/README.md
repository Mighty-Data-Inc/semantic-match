# mightydatainc-json-surgery

Iterative, AI-guided JSON modification powered by OpenAI. Pass in any JSON-compatible object and natural-language instructions; the package breaks the task into discrete atomic operations (assign, delete, append, insert, rename) that are verified and applied one by one until the object satisfies your instructions.

## Installation

```bash
pip install mightydatainc-json-surgery
```

## Quick Start

```python
from openai import OpenAI
from mightydatainc_json_surgery import json_surgery

client = OpenAI()

data = {
    "title": "My Report",
    "items": [
        {"id": 1, "status": "draft"},
        {"id": 2, "status": "draft"},
    ],
}

result = json_surgery(
    openai_client=client,
    obj=data,
    modification_instructions='Set the status of every item to "published".',
)
print(result)
```

## `JSONSurgeryOptions`

All options are optional.

| Option | Type | Description |
|---|---|---|
| `schema_description` | `str` | Human-readable schema description passed to the model so it can stay within the expected structure. |
| `skipped_keys` | `list[str]` | Keys to omit from the placemarked JSON representation shown to the model (e.g. large blobs irrelevant to the task). |
| `on_validate_before_return` | `Callable[[Any], ValidationResult \| None]` | Called before the final object is returned. Return `errors` to force another round of corrections, or `obj_corrected` to substitute a fixed version. |
| `on_work_in_progress` | `Callable[[Any], Any \| None]` | Called at the start of each iteration (after the first). Receives the current in-progress object; return a replacement to override it. |
| `give_up_after_seconds` | `int` | Raise `JSONSurgeryError` if the process exceeds this many seconds. |
| `give_up_after_iterations` | `int` | Raise `JSONSurgeryError` if the process exceeds this many iterations. |

```python
from mightydatainc_json_surgery import json_surgery, JSONSurgeryOptions

def validate(obj):
    if not obj.get("title"):
        return {"errors": ["title is required"]}

result = json_surgery(
    openai_client=client,
    obj=data,
    modification_instructions="Remove the 'draft' items and capitalise the title.",
    options=JSONSurgeryOptions(
        schema_description="Object with a 'title' string and an 'items' array.",
        give_up_after_seconds=120,
        give_up_after_iterations=20,
        on_validate_before_return=validate,
    ),
)
```

## `JSONSurgeryError`

Raised when the process times out or exceeds the iteration limit. The partially-modified object is available on the exception as `.obj`.

```python
from mightydatainc_json_surgery import json_surgery, JSONSurgeryError

try:
    result = json_surgery(
        openai_client=client,
        obj=data,
        modification_instructions="...",
        options={"give_up_after_iterations": 5},
    )
except JSONSurgeryError as e:
    print("Gave up:", e)
    print("Last known state:", e.obj)
```

## Utility exports

### `placemarked_json_stringify`

Serializes a JSON-compatible object to a string annotated with path comments, the same format shown to the model internally.

```python
from mightydatainc_json_surgery import placemarked_json_stringify

print(placemarked_json_stringify({"a": [1, 2]}, indent=2))
# // root
# {
#   // root["a"]
#   "a": [
#     // root["a"][0]
#     1,
#
#     // root["a"][1]
#     2
#   ]
# }
```

### `navigate_to_json_path`

Traverses a JSON-compatible object by a path list and returns the parent, key/index, and target.

```python
from mightydatainc_json_surgery import navigate_to_json_path

result = navigate_to_json_path({"items": [{"name": "Alice"}]}, ["items", 0, "name"])
print(result["path_target"])  # "Alice"
```

## Local dev (Windows)

From `packages/python-json-surgery`, activate the package venv and run tests:

```powershell
.\.venv\Scripts\Activate.ps1
python -m pytest tests/ -v
```

## Notes

- Package name for `pip install` is `mightydatainc-json-surgery`.
- Python import package is `mightydatainc_json_surgery`.
- Requires Python 3.13+ and `mightydatainc-gpt-conversation>=1.3.2`.
- `json_surgery` deep-copies the input object; the original is never mutated.

