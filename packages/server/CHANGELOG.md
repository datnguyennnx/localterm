# localterm-server

## 0.2.1

### Patch Changes

- Add configurable terminal border and padding layout inspired by openmux

  - Inner padding (activePaddingX/Y) between border and terminal content
  - Outer padding (activeOuterPaddingX/Y) between viewport edge and border
  - Rounded border with focus-aware color (#444 unfocused, #00AAFF focused)

## 0.2.0

### Minor Changes

- feat: add session reattach with grace period (S1)

  - Add session identity (crypto UUID), park/destroy lifecycle, tail buffer
  - WS disconnect parks session (60s), reconnect reattaches via sessionId
  - Fix listener accumulation on park/reattach cycle
  - Fix zombie sessions in registry after park timeout
  - Clean up orphaned RPC sessions on WS disconnect
  - Dispose pty.onData/onExit IDisposables on destroy
  - Guard command-boundary emission behind agent mode
  - Clean up as any type assertions in tests

## 0.1.5

### Patch Changes

- refactor: remove unused dead code across packages
  - Removed unused exports, files, and types identified by knip
  - Removed unused zod dependency from CLI
  - Simplified package.json scripts (merged redundant commands, lint auto-fixes)
  - Cleaned up knip configuration hints

## 0.1.4

### Patch Changes

- - refactor: restructure apps/terminal/src/ by domain (lib/utils → features/terminal/<subdomain>/, platform/, storage/, pwa/)
  - refactor: extract 14 terminal hooks into individual files under hooks/ with barrel export
  - refactor: split settings-menu.tsx into 5 subcomponents + hook (423→153 LoC)
  - refactor: split index.tsx into 4 extracted hooks (841→477 LoC)
  - refactor: extract usePointerScrub from number-stepper.tsx (170→89 LoC)
  - refactor: extract useLocalFonts from local-font-picker.tsx (244→182 LoC)
  - fix: search overlay no longer always visible, respects isSearchOpen state
  - style: remove decorative section divider comments across all files

## 0.1.3

### Patch Changes

- chore: bump version to 0.1.3 (no code changes to published packages)

## 0.1.2

### Patch Changes

- - fix: WebSocket close code 1008 caused by `stripPort` IPv6 detection bug
  - fix: stale server dist files silently ignored source changes
  - feat: dev mode redirect page when static root is null
  - feat: `LOCALTERM_DEV` env var to prevent stale static serving in dev mode
  - chore: `RestartOptions.foreground` type consistency
  - chore: `dev:all` opens Vite dev URL (5174) instead of server URL

## 0.1.1

### Patch Changes

- fix: add --foreground support to restart command

## 0.1.0

### Minor Changes

- formmatter & lint

## 0.0.16

### Patch Changes

- Major refactoring: restructure server into feature folders (agent/, session/, parser/, server/, utils/), merge duplicate OSC parsers into generic OscChunkParser<T>, consolidate strip-ansi into single-pass regex, fix ArrayBuffer pooled buffer corruption in output batcher, fix surrogate pair splitting across flush boundaries, fix agent RPC memory leak, replace unsafe `as` casts with Zod validation, add agent token caching, fix `pty.process` throw edge case, clean up dead code and enforce type safety across all modules

## 0.0.15

### Patch Changes

- fix

## 0.0.14

### Patch Changes

- fix

## 0.0.13

### Patch Changes

- fix

## 0.0.12

### Patch Changes

- fix

## 0.0.11

### Patch Changes

- fix

## 0.0.10

### Patch Changes

- fix

## 0.0.9

### Patch Changes

- fix

## 0.0.8

### Patch Changes

- fix

## 0.0.7

### Patch Changes

- fix

## 0.0.6

### Patch Changes

- fix

## 0.0.5

### Patch Changes

- fix

## 0.0.4

### Patch Changes

- fix

## 0.0.3

### Patch Changes

- fix

## 0.0.2

### Patch Changes

- Fix `posix_spawnp failed` error on first shell spawn after `npm install -g localterm`.

  node-pty's prebuilt `spawn-helper` binary loses the executable bit through some npm install paths. We now `chmod 0o755` it lazily inside the `Session` constructor so the very first spawn always works, regardless of how the package was installed (npm, pnpm, yarn, monorepo, global, local).

## 0.0.1

### Patch Changes

- Initial public release.

  `localterm` is a browser-based terminal: one browser tab is one persistent PTY session. The CLI (`localterm start`) spins up a Hono + node-pty + headless-xterm daemon at `http://localterm.localhost:3417/` and ships the xterm.js front-end in the same package. Sessions are addressed by friendly `adjective-animal-suffix` ids in the URL path; closing a tab retires its shell after a 30-second grace window.
