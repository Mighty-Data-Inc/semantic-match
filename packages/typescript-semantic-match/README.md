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

## Find one matching item in a list: `findSemanticMatch`

Use `findSemanticMatch` when you have one item and want to know whether it already exists in a canonical list.

```ts
import { OpenAI } from 'openai';
import { findSemanticMatch } from '@mightydatainc/semantic-match';

const client = new OpenAI();
const items = ['Invoice Number', 'Vendor', 'Purchase Date'];

// "Invoice ID" likely means the same thing as "Invoice Number"
const index1 = await findSemanticMatch(client, items, 'Invoice ID');
console.log(index1); // 0

// No close semantic equivalent in the list
const index2 = await findSemanticMatch(client, items, 'Tax Registration ID');
console.log(index2); // -1
```

Why this is useful:

- lets you map incoming labels to canonical names
- avoids duplicate concepts caused by wording differences
- returns `-1` when no strong match is found

## Compare two lists for unchanged/removed/added/renamed: `compareItemLists`

Use `compareItemLists` when you want a source-to-source diff with semantic awareness.

```ts
import { OpenAI } from 'openai';
import { compareItemLists } from '@mightydatainc/semantic-match';

const client = new OpenAI();

const before = ['Invoice Number', 'Vendor', 'Purchase Date', 'Subtotal'];
const after = ['Invoice ID', 'Supplier', 'Date', 'Pre-Tax Total'];

const results = await compareItemLists(client, before, after);
for (const row of results) {
  console.log(row.classification, row.item, row.newName);
}
```

Why this is useful:

- you get a practical change log, not just string-level differences
- renamed vs removed+added is handled more intelligently
- output is straightforward to feed into normalization or reporting logic

## Optional details: use `name` and `description` instead of just strings

Plain strings work well when names are clear.

Use objects with `name` + optional `description` when names are ambiguous or overloaded. The description gives the matcher extra context so it can choose the right meaning.

Example:

```ts
import { OpenAI } from 'openai';
import { findSemanticMatch } from '@mightydatainc/semantic-match';

const client = new OpenAI();

const items = [
  {
    name: 'Georgia',
    description: 'Country in the South Caucasus. Capital: Tbilisi.',
  },
  {
    name: 'Georgia',
    description: 'U.S. state in the Southeast. Capital: Atlanta.',
  },
];

const query = {
  name: 'Georgia',
  description: 'State in the southeastern United States',
};

const index = await findSemanticMatch(client, items, query);
console.log(index); // 1
```

Without descriptions, both entries look identical by name alone.

## Installation and usage

```bash
npm install @mightydatainc/semantic-match
```

```ts
import {
  findSemanticMatch,
  compareItemLists,
} from '@mightydatainc/semantic-match';
```

Requires Node.js
