# mightydatainc-semantic-match

This package is a "same thing, different words" detector for list names.

Imagine you process invoice data from multiple contractors.

- One file says: "Invoice Number"
- Another says: "Invoice ID"
- One source says: "Vendor"
- Another says: "Supplier"

A normal string match says those are different.
This package helps you recognize they likely mean the same concept.

It helps answer a common normalization question:

"Do these two labels refer to the same thing, even if they are worded differently?"

Use it for lists of names, such as:

- column names
- metric names
- category names
- status names

Think of it this way:

- Exact text match asks: "Are these letters identical?"
- This package asks: "Do these labels mean the same thing?"

That makes it easier to distinguish genuinely new/removed fields from things that are simply labeled differently by different sources.

## Purpose and intent

Use this package when you need to compare two versions of a list and understand what changed in human terms:

- unchanged (same meaning)
- renamed (same concept, different label)
- removed
- added

It is especially useful when reconciling client, vendor, and user-provided data that use inconsistent naming for the same concepts.

## Find one matching item in a list: `find_semantic_match`

Use `find_semantic_match` when you have one item and want to know whether it already exists in a canonical list.

```python
from openai import OpenAI
from mightydatainc_semantic_match import find_semantic_match

client = OpenAI()
items = ["Invoice Number", "Vendor", "Purchase Date"]

# "Invoice ID" likely means the same thing as "Invoice Number"
index = find_semantic_match(client, items, "Invoice ID")
print(index)  # 0

# No close semantic equivalent in the list
index = find_semantic_match(client, items, "Tax Registration ID")
print(index)  # -1
```

Why this is useful:

- lets you map incoming labels to canonical names
- avoids duplicate concepts caused by wording differences
- returns `-1` when no strong match is found

## Compare two lists for unchanged/removed/added/renamed: `compare_item_lists`

Use `compare_item_lists` when you want a source-to-source diff with semantic awareness.

```python
from openai import OpenAI
from mightydatainc_semantic_match import compare_item_lists

client = OpenAI()

before = ["Invoice Number", "Vendor", "Purchase Date", "Subtotal"]
after = ["Invoice ID", "Supplier", "Date", "Pre-Tax Total"]

results = compare_item_lists(client, before, after)
for row in results:
    print(row["classification"], row["item"], row.get("new_name"))
```

Why this is useful:

- you get a practical change log, not just string-level differences
- renamed vs removed+added is handled more intelligently
- output is straightforward to feed into normalization or reporting logic

## Optional details: use `name` and `description` instead of just strings

Plain strings work well when names are clear.

Use objects with `name` + optional `description` when names are ambiguous or overloaded. The description gives the matcher extra context so it can choose the right meaning.

Example:

```python
from openai import OpenAI
from mightydatainc_semantic_match import find_semantic_match

client = OpenAI()

items = [
    {
        "name": "Georgia",
        "description": "Country in the South Caucasus. Capital: Tbilisi.",
    },
    {
        "name": "Georgia",
        "description": "U.S. state in the Southeast. Capital: Atlanta.",
    },
]

query = {
    "name": "Georgia",
    "description": "State in the southeastern United States",
}

index = find_semantic_match(client, items, query)
print(index)  # 1
```

Without descriptions, both entries look identical by name alone.

## Installation and usage

```bash
pip install mightydatainc-semantic-match
```

```python
import mightydatainc_semantic_match
```

Requires Python 3.13+
