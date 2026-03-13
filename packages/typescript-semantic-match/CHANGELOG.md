# Changelog

All notable changes to this package will be documented in this file.

## [1.3.0] - 2026-03-12

### Added

- Added `getSemanticallyDistinctGroups` and `removeSemanticDuplicates` to support semantic deduplication workflows.
- Added dedicated live API tests for `getSemanticallyDistinctGroups` and `removeSemanticDuplicates`.

### Changed

- Exported `getSemanticallyDistinctGroups` from the package entrypoint.

## [1.2.0] - 2026-03-09

### Changed

- Updated dependencies.
- Updated README documentation and examples.

## [1.1.2] - 2026-03-04

### Chore

- Version bump to re-trigger the CI/CD pipeline.

## [1.1.1] - 2026-03-04

### Fixed

- Re-wrote `README.md` using `create_file` to ensure valid UTF-8 encoding (previous write via PowerShell heredoc produced Windows-1252).

## [1.1.0] - 2026-03-04

### Fixed

- Corrected package description in `package.json` (was copy-pasted from a different project).
- Rewrote `README.md` to document this package accurately.
