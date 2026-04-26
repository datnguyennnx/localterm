# localterm

A browser-based terminal hub: persistent PTY sessions on the server, xterm.js + shadcn UI in the browser. Built as a pnpm monorepo on top of [vite-plus](https://github.com/voidzero-dev/vite-plus) and [turbo](https://turbo.build).

## Quick start

```bash
pnpm install
pnpm build
pnpm exec localterm start
```

Opens `http://127.0.0.1:3417` in your browser. `Ctrl+C` stops the daemon and tears down all sessions.

## CLI

```bash
localterm start [-p 3417] [-H 127.0.0.1] [--no-open]
localterm stop
localterm status
localterm restart        # detached restart, logs to ~/.localterm/server.log
localterm list           # ls
localterm new [-c cwd] [-s shell]
localterm kill <id>
```

State lives in `~/.localterm/` (PID, port, server log).

`localterm` only binds loopback hosts (`127.0.0.1`, `localhost`, `::1`); non-loopback values are rejected. All `/api` and `/ws` routes additionally check the `Host` and `Origin` headers to defeat DNS-rebinding attacks.

## Keybindings

`Cmd+T`, `Cmd+W`, and `Cmd+1`–`9` are claimed by the browser before the page can see them, so the in-browser bindings are mapped to combos the browser leaves alone. If you want the native versions, install localterm as a standalone PWA — once it's a separate window the shortcuts work as expected.

| In-browser tab              | PWA / standalone | Action          |
| --------------------------- | ---------------- | --------------- |
| `Cmd/Ctrl+Option+T`         | `Cmd+T`          | new tab         |
| `Cmd/Ctrl+Option+W`         | `Cmd+W`          | close tab       |
| `Cmd/Ctrl+]` / `Cmd/Ctrl+[` | same             | next / prev tab |
| `Cmd/Ctrl+Option+1`–`9`     | `Cmd+1`–`9`      | jump to tab N   |
| `Cmd/Ctrl+F`                | same             | find in tab     |
| Middle-click tab            | same             | close tab       |
| `Esc`                       | same             | close find bar  |

To install on Chrome/Edge: open `localterm`, click the install icon in the URL bar (or `⋮` → "Install localterm"). On Safari: `File → Add to Dock`.

## Structure

```
apps/
  web/          # vite + react + tailwind v4 + shadcn + xterm.js
packages/
  server/       # hono + ws + node-pty + headless xterm (state mirror)
  cli/          # commander entry: start/stop/status/restart/list/new/kill
```

The server keeps a `@xterm/headless` instance per session, fed from every PTY chunk. On reconnect, the WebSocket sends a `serialize()` snapshot before live output resumes — so reloading the page (or even restarting the browser) restores vim/htop/less state exactly.

## Scripts

- `pnpm build` — turbo build (web → server → cli)
- `pnpm dev` — turbo watch all packages
- `pnpm test` / `pnpm typecheck` / `pnpm lint` / `pnpm format`

See `AGENTS.md` for code style and `CONTRIBUTING.md` for the contribution flow.
