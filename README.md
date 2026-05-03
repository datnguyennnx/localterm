# localterm

[![version](https://img.shields.io/npm/v/localterm?style=flat&colorA=000000&colorB=000000)](https://npmjs.com/package/localterm)
[![downloads](https://img.shields.io/npm/dt/localterm.svg?style=flat&colorA=000000&colorB=000000)](https://npmjs.com/package/localterm)

Your terminal should just be a browser tab.

How? Run `npx localterm start` and every browser tab becomes its own persistent shell — open a new tab to spawn another, close it to retire it, reload to restore it (vim/htop/less state and all).

## Install

Run this command anywhere:

```bash
npx localterm start
```

This boots a local daemon and opens `http://localterm.localhost:3417` in your browser. (`*.localhost` is reserved by [RFC 6761](https://datatracker.ietf.org/doc/html/rfc6761) and resolves to `127.0.0.1` in every modern browser, so no `/etc/hosts` edit needed.)

To install globally:

```bash
npm install -g localterm
localterm start
```

## Usage

The mental model is **shell = browser tab**:

- **New tab** → new shell
- **Close tab** → daemon reaps the shell after a short grace window
- **Reload** → same shell restores exactly (the page writes its session id into the URL, e.g. `http://localterm.localhost:3417/jolly-chipmunk-trea`)

On reconnect, the WebSocket sends a `serialize()` snapshot from a per-session headless xterm before live output resumes, so reloading the page (or even restarting the browser) restores vim/htop/less state byte-for-byte.

## CLI

```bash
localterm start [-p 3417] [-H 127.0.0.1] [--no-open]   # daemonizes by default
localterm stop
localterm status
localterm restart        # detached restart, logs to ~/.localterm/server.log
localterm list           # alias: ls
localterm new [-c cwd] [-s shell]
localterm kill <id>
```

State lives in `~/.localterm/` (PID, port, server log).

## Security

`localterm` only binds loopback hosts (`127.0.0.1`, `localhost`, `*.localhost`, `::1`); non-loopback values are rejected. All `/api` and `/ws` routes additionally check the `Host` and `Origin` headers to defeat DNS-rebinding attacks.

## Structure

This is a pnpm monorepo built on [vite-plus](https://github.com/voidzero-dev/vite-plus) and [turbo](https://turbo.build):

```
apps/
  web/          # vite + react + tailwind v4 + xterm.js
packages/
  server/       # hono + ws + node-pty + headless xterm (state mirror, idle reaper)
  cli/          # commander entry: start/stop/status/restart/list/new/kill
```

## Resources & Contributing Back

Looking to contribute back? Check out the [Contributing Guide](https://github.com/aidenybai/localterm/blob/main/CONTRIBUTING.md) and `AGENTS.md` for code style.

Find a bug? Head over to our [issue tracker](https://github.com/aidenybai/localterm/issues) and we'll do our best to help. We love pull requests, too!

[**→ Start contributing on GitHub**](https://github.com/aidenybai/localterm/blob/main/CONTRIBUTING.md)

### License

localterm is MIT-licensed open-source software.
