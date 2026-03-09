# mightydatainc-semantic-match

This package is a "same thing, different words" detector for list names.

Imagine you have two spreadsheets.

- Old sheet says: "Customer ID"
- New sheet says: "Client Identifier"

A normal string match says those are different.
This package helps you recognize they likely mean the same concept.

It helps answer a common migration question:

"Do these two labels refer to the same thing, even if they are worded differently?"

Use it for lists of names, such as:

- column names
- metric names
- category names
- status names

Think of it this way:

- Exact text match asks: "Are these letters identical?"
- This package asks: "Do these labels mean the same thing?"

That makes it easier to distinguish additions/removals from things that simply got renamed.

## Purpose and intent

Use this package when you need to compare two versions of a list and understand what changed in human terms:

- unchanged (same meaning)
- renamed (same concept, different label)
- removed
- added

It is especially useful during schema evolution, dashboard refactors, and terminology cleanup.

## Find one matching item in a list: `find_semantic_match`

Use `find_semantic_match` when you have one item and want to know whether it already exists in a canonical list.

```python
from openai import OpenAI
from mightydatainc_semantic_match import find_semantic_match

client = OpenAI()
items = ["Customer ID", "Order Date", "Total Amount"]

# "Client Identifier" means the same thing as "Customer ID"
index = find_semantic_match(client, items, "Client Identifier")
print(index)  # 0

# No close semantic equivalent in the list
index = find_semantic_match(client, items, "Product Name")
print(index)  # -1
```

Why this is useful:

- lets you map incoming labels to canonical names
- avoids duplicate concepts caused by wording differences
- returns `-1` when no strong match is found

## Compare two lists for unchanged/removed/added/renamed: `compare_item_lists`

Use `compare_item_lists` when you want a migration-style diff with semantic awareness.

```python
from openai import OpenAI
from mightydatainc_semantic_match import compare_item_lists

client = OpenAI()

before = ["Customer ID", "Order Date", "Unit Price", "Total Amount"]
after = ["Client ID", "Order Date", "Grand Total"]

results = compare_item_lists(client, before, after)
for row in results:
    print(row["classification"], row["item"], row.get("new_name"))
```

Why this is useful:

- you get a practical change log, not just string-level differences
- renamed vs removed+added is handled more intelligently
- output is straightforward to feed into migration or reporting logic

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
