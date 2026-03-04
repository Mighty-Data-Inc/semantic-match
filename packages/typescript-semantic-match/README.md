# @mightydatainc/json-surgery

Iterative, AI-guided JSON modification powered by OpenAI. Pass in any JSON-compatible object and natural-language instructions; the package breaks the task into discrete atomic operations (assign, delete, append, insert, rename) that are verified and applied one by one until the object satisfies your instructions.

## Installation

```bash
npm install @mightydatainc/json-surgery
```

## Quick Start

```ts
import OpenAI from 'openai';
import { jsonSurgery } from '@mightydatainc/json-surgery';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const data = {
  title: 'My Report',
  items: [
    { id: 1, status: 'draft' },
    { id: 2, status: 'draft' },
  ],
};

const result = await jsonSurgery(
  client,
  data,
  'Set the status of every item to "published".'
);
console.log(result);
```

## `JSONSurgeryOptions`

All options are optional.

| Option | Type | Description |
|---|---|---|
| `schemaDescription` | `string` | Human-readable schema description passed to the model so it can stay within the expected structure. |
| `skippedKeys` | `string[]` | Keys to omit from the placemarked JSON shown to the model (e.g. large blobs irrelevant to the task). |
| `onValidateBeforeReturn` | `(obj) => Promise<{ objCorrected?: any; errors?: string[] } \| undefined>` | Called before the final object is returned. Return `errors` to force another round of corrections, or `objCorrected` to substitute a fixed version. |
| `onWorkInProgress` | `(obj) => Promise<any \| undefined>` | Called at the start of each iteration after the first. Receives the current in-progress object; return a replacement to override it, or throw to abort. |
| `giveUpAfterSeconds` | `number` | Throw `JSONSurgeryError` if the process exceeds this many seconds. |
| `giveUpAfterIterations` | `number` | Throw `JSONSurgeryError` if the process exceeds this many iterations. |

```ts
import OpenAI from 'openai';
import { jsonSurgery, JSONSurgeryOptions } from '@mightydatainc/json-surgery';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const options: JSONSurgeryOptions = {
  schemaDescription: "Object with a 'title' string and an 'items' array.",
  giveUpAfterSeconds: 120,
  giveUpAfterIterations: 20,
  onValidateBeforeReturn: async (obj) => {
    if (!obj.title) return { errors: ['title is required'] };
  },
};

const result = await jsonSurgery(
  client,
  data,
  "Remove the 'draft' items and capitalise the title.",
  options
);
```

## `JSONSurgeryError`

Thrown when the process times out or exceeds the iteration limit. The partially-modified object is available on the exception as `.obj`.

```ts
import { jsonSurgery, JSONSurgeryError } from '@mightydatainc/json-surgery';

try {
  const result = await jsonSurgery(client, data, '...', {
    giveUpAfterIterations: 5,
  });
} catch (e) {
  if (e instanceof JSONSurgeryError) {
    console.error('Gave up:', e.message);
    console.log('Last known state:', e.obj);
  }
}
```

## Utility exports

### `placemarkedJSONStringify`

Serializes a JSON-compatible object to a string annotated with path comments, the same format shown to the model internally.

```ts
import { placemarkedJSONStringify } from '@mightydatainc/json-surgery';

console.log(placemarkedJSONStringify({ a: [1, 2] }, 2));
// // root
// {
//   // root["a"]
//   "a": [
//     // root["a"][0]
//     1,
//
//     // root["a"][1]
//     2
//   ]
// }
```

### `navigateToJSONPath`

Traverses a JSON-compatible object by a path array and returns the parent, key/index, and target.

```ts
import { navigateToJSONPath } from '@mightydatainc/json-surgery';

const result = navigateToJSONPath({ items: [{ name: 'Alice' }] }, ['items', 0, 'name']);
console.log(result.pathTarget); // "Alice"
```

## Local dev

From `packages/typescript-json-surgery`:

```bash
npm ci
npm test
npm run build
```

## Notes

- Package name for `npm install` is `@mightydatainc/json-surgery`.
- `jsonSurgery` deep-copies the input object; the original is never mutated.
- Requires `@mightydatainc/gpt-conversation >= 1.3.3`.
