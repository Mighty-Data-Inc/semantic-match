# semantic-match

semantic-match helps teams answer a simple but expensive question:

"Are these two labels different words for the same thing?"

When you ingest data from clients, users, vendors, and other external sources, naming is rarely consistent. One provider might send "Invoice Number" while another sends "Invoice ID," and one source might say "Vendor" while another says "Supplier." Traditional string matching sees only text differences. `semantic-match` helps you preserve meaning across those variations so your team can move faster with fewer mistakes.

## Why teams use it

- Reduce normalization friction when source labels vary.
- Keep canonical naming consistent across external data sources and internal systems.
- Distinguish true additions/removals from wording changes.
- Improve confidence during refactors, standardization, and cleanup efforts.

## What it does

semantic-match compares named items using semantic understanding, not just character-by-character equality.

At a practical level, it helps with two high-value workflows:

- Resolving an incoming label to the best existing canonical label.
- Comparing two versions of a list and identifying unchanged, renamed, removed, and added items.

The result is a cleaner, more human-meaningful view of change.

## Where it fits

semantic-match is a good fit for teams working on:

- receipt and invoice ingestion from many providers
- client and partner data onboarding pipelines
- user-uploaded files with inconsistent headers
- cross-source field normalization
- schema evolution
- BI and analytics model refactors
- taxonomy and terminology harmonization
- integrations between systems with inconsistent naming

## Repository packages

This repository includes maintained packages for:

- TypeScript: [packages/typescript-semantic-match](packages/typescript-semantic-match)
- Python: [packages/python-semantic-match](packages/python-semantic-match)

For language-specific installation and usage details, use each package README:

- [packages/typescript-semantic-match/README.md](packages/typescript-semantic-match/README.md)
- [packages/python-semantic-match/README.md](packages/python-semantic-match/README.md)

## About Mighty Data Inc.

semantic-match is built and maintained by Mighty Data Inc. for real-world data operations where naming drift is common and semantic continuity matters.
