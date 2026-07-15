# Versioning Instructions

This project uses **Changesets** for version management and npm publishing.

## How to version

### 1. Create a changeset

After making changes that should be released:

```bash
pnpm changeset
```

Follow the prompts:

- Select which packages changed
- Choose bump type (patch/minor/major)
- Write a summary of what changed

This creates a markdown file in `.changeset/*.md`.

### 2. Consume the changeset (version bump)

```bash
pnpm changeset version
```

This:

- Reads all pending changeset files and deletes them
- Bumps version in `package.json` for affected packages
- Updates `CHANGELOG.md` for each affected package with the changeset summary

### 3. Commit the version

```bash
git add -A
git commit -m "chore: bump version to X.Y.Z"
```

### 4. Publish to npm

```bash
pnpm build
pnpm changeset publish
```

Requires `npm login` and npm token configured.

## Version strategy

| Bump    | When                                     | Example         |
| ------- | ---------------------------------------- | --------------- |
| `patch` | Bug fixes, refactoring, internal cleanup | 0.0.15 → 0.0.16 |
| `minor` | New features, public API additions       | 0.0.16 → 0.1.0  |
| `major` | Breaking changes                         | 0.1.0 → 1.0.0   |

## Package pairing

- `@datnguyennnx/localterm` (CLI) and `@datnguyennnx/localterm-server` (server) are **fixed** — they share the same version number. Always select both in the changeset prompt.
- `@localterm/terminal` (browser app) and `@localterm/website` are **ignored** — they are not published to npm. Do not select them.

## CHANGELOG.md format

Changelogs are auto-generated from changeset summaries. Group changes under clear headings when editing manually:

```markdown
## 0.0.17

### Breaking

- description

### Features

- description

### Bug Fixes

- description

### Performance

- description

### Refactoring

- description
```

## Before publishing checklist

- [ ] All tests pass: `pnpm test`
- [ ] TypeScript compiles: `pnpm typecheck`
- [ ] Lint passes: `pnpm lint`
- [ ] Format applied: `pnpm format`
- [ ] Changeset created and consumed
- [ ] Build succeeds: `pnpm build`
