# Versioning Workflow

This monorepo uses **Changesets** (`@changesets/cli`) via pnpm run for version management. Each workspace under `apps/*` and `packages/*` is versioned independently.

## Workflow 

```bash

# 1. Before commit and public checklist
pnpm run test
pnpm run typecheck
pnpm run lint
pnpm run format
pnpm run build

# 2. Create a changeset entry describing the change
pnpm run changeset

# 3. Consume pending changesets — bump versions + update CHANGELOGs
pnpm run changeset version

# 4. Stage all files (changesets are auto-deleted; package.json and CHANGELOG.md updated)  -> always using git diff and git show to overview again what changes and group files change related to packages/ or apps/
git add -A

# 5. Commit with a short 1-line Conventional Commits message -> always using git diff and git show to overview again what changes
git commit -m "fix(packages/server): security websocket"

# 6. Push
git push
```

> **Note:** `commit: false` is set in `.changeset/config.json`. Changesets will NOT commit for you. You must commit manually.

## 1. Writing a Changeset — Full Descriptions

Run `pnpm run changeset` and follow the prompts:

1. Select which package(s) changed (`<space>` to toggle, `<enter>` to confirm).
2. Choose bump type — **patch** (bug fix), **minor** (new feature), or **major** (breaking change).
3. Write a summary describing what changed, why, and how it affects consumers following bullet point and keep it short.

For non-interactive environments, create a markdown file in `.changeset/`:

## 2. Bumping Versions — package.json Sync

Run `pnpm run changeset version`. This will:

- Delete all consumed `.changeset/*.md` files.
- Update the `version` field in **each affected package's `package.json`** to match the bump.
- Generate/update `CHANGELOG.md` for each affected package.
- Update any internal workspace dependency ranges (e.g., if `"@datnguyennnx/localterm-server` bumps, `apps/terminal`'s dependency on `"@datnguyennnx/localterm-server` is updated automatically per `updateInternalDependencies: "patch"`). Double check with turbo.json with malicious think.

**Always review** the resulting `package.json` version fields before committing.

## 3. Git Commit Messages — Conventional Commits

The commit must be a **single 1-line message** using Conventional Commits format:

```
type(scope): short description
```

| Type       | When to use                                     |
| ---------- | ----------------------------------------------- |
| `feat`     | A new feature or component                      |
| `fix`      | A bug fix                                       |
| `refactor` | Code change that is neither a fix nor a feature |
| `chore`    | Version bumps, config, tooling, CI              |
| `docs`     | Documentation-only changes                      |
| `style`    | Formatting, whitespace (not CSS)                |

## 4. Bump Type Guide

| Bump    | When                                     | Example       |
| ------- | ---------------------------------------- | ------------- |
| `patch` | Bug fixes, refactoring, internal cleanup | 0.0.0 → 0.0.1 |
| `minor` | New features, public API additions       | 0.0.1 → 0.1.0 |
| `major` | Breaking changes                         | 0.1.0 → 1.0.0 |

## 5. Publish to npm

After committing the version bump:

```bash
pnpm build
pnpm changeset publish
```
