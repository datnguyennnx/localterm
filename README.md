# localterm

[![version](https://img.shields.io/npm/v/localterm?style=flat&colorA=000000&colorB=000000)](https://npmjs.com/package/localterm)
[![downloads](https://img.shields.io/npm/dt/localterm.svg?style=flat&colorA=000000&colorB=000000)](https://npmjs.com/package/localterm)

Your terminal should just be a browser tab.

How? Run `npx localterm start` and every browser tab is one shell. Open a new tab to spawn another. Close the tab to kill it. That's it.

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
- **Close tab** → shell dies immediately
- **Reload tab** → fresh shell (the prior one is gone; the browser will warn before reload once you've typed)

That's the whole product. No session ids, no URL slugs, no reconnects. If you want a long-lived shell that survives browser reloads, use tmux _inside_ localterm.

## CLI

```bash
localterm start [-p 3417] [-H 127.0.0.1] [--no-open]   # daemonizes by default
localterm stop
localterm status
localterm restart        # detached restart, logs to ~/.localterm/server.log
```

State lives in `~/.localterm/` (PID, port, server log).

## Security

`localterm` only binds loopback hosts (`127.0.0.1`, `localhost`, `*.localhost`, `::1`); non-loopback values are rejected. The `/api/health` and `/ws` routes additionally check the `Host` and `Origin` headers to defeat DNS-rebinding attacks.

## Structure

This is a pnpm monorepo built on [vite-plus](https://github.com/voidzero-dev/vite-plus) and [turbo](https://turbo.build):

```
apps/
  terminal/     # vite + react + tailwind v4 + xterm.js (the in-browser terminal UI)
  website/      # static redirect to github.com/millionco/localterm
packages/
  server/       # hono + ws + node-pty (one PTY per WebSocket, killed on close)
  cli/          # commander entry: start/stop/status/restart
```

## Resources & Contributing Back

Looking to contribute back? Check out the [Contributing Guide](https://github.com/aidenybai/localterm/blob/main/CONTRIBUTING.md) and `AGENTS.md` for code style.

Find a bug? Head over to our [issue tracker](https://github.com/aidenybai/localterm/issues) and we'll do our best to help. We love pull requests, too!

[**→ Start contributing on GitHub**](https://github.com/aidenybai/localterm/blob/main/CONTRIBUTING.md)

### License

localterm is MIT-licensed open-source software.
