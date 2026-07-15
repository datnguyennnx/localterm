# localterm

## 0.1.0

### Minor Changes

- formmatter & lint

### Patch Changes

- Updated dependencies
  - @datnguyennnx/localterm-server@0.1.0

## 0.0.16

### Patch Changes

- Major refactoring: restructure server into feature folders, split terminal.tsx into 9 modules, simplify themes (16→3) and fonts (11→3), consolidate localStorage storage layer, fix ArrayBuffer pooled buffer corruption, surrogate pair splitting, SSR crash, memory leaks, CLI exit codes, and 40+ other bugs and performance issues
  - @datnguyennnx/localterm-server@0.0.16

## 0.0.15

### Patch Changes

- fix
- Updated dependencies
  - localterm-server@0.0.15

## 0.0.14

### Patch Changes

- fix
- Updated dependencies
  - localterm-server@0.0.14

## 0.0.13

### Patch Changes

- fix
- Updated dependencies
  - localterm-server@0.0.13

## 0.0.12

### Patch Changes

- fix
- Updated dependencies
  - localterm-server@0.0.12

## 0.0.11

### Patch Changes

- fix
- Updated dependencies
  - localterm-server@0.0.11

## 0.0.10

### Patch Changes

- fix
- Updated dependencies
  - localterm-server@0.0.10

## 0.0.9

### Patch Changes

- fix
- Updated dependencies
  - localterm-server@0.0.9

## 0.0.8

### Patch Changes

- fix
- Updated dependencies
  - localterm-server@0.0.8

## 0.0.7

### Patch Changes

- fix
- Updated dependencies
  - localterm-server@0.0.7

## 0.0.6

### Patch Changes

- fix
- Updated dependencies
  - localterm-server@0.0.6

## 0.0.5

### Patch Changes

- fix
- Updated dependencies
  - localterm-server@0.0.5

## 0.0.4

### Patch Changes

- fix
- Updated dependencies
  - localterm-server@0.0.4

## 0.0.3

### Patch Changes

- fix
- Updated dependencies
  - localterm-server@0.0.3

## 0.0.2

### Patch Changes

- Fix `posix_spawnp failed` error on first shell spawn after `npm install -g localterm`.

  node-pty's prebuilt `spawn-helper` binary loses the executable bit through some npm install paths. We now `chmod 0o755` it lazily inside the `Session` constructor so the very first spawn always works, regardless of how the package was installed (npm, pnpm, yarn, monorepo, global, local).

- Updated dependencies
  - localterm-server@0.0.2

## 0.0.1

### Patch Changes

- Initial public release.

  `localterm` is a browser-based terminal: one browser tab is one persistent PTY session. The CLI (`localterm start`) spins up a Hono + node-pty + headless-xterm daemon at `http://localterm.localhost:3417/` and ships the xterm.js front-end in the same package. Sessions are addressed by friendly `adjective-animal-suffix` ids in the URL path; closing a tab retires its shell after a 30-second grace window.

- Updated dependencies
  - localterm-server@0.0.1
