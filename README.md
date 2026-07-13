# localterm

[![version](https://img.shields.io/npm/v/@datnguyennnx/localterm?style=flat&colorA=000000&colorB=000000)](https://npmjs.com/package/@datnguyennnx/localterm)
[![downloads](https://img.shields.io/npm/dt/@datnguyennnx/localterm.svg?style=flat&colorA=000000&colorB=000000)](https://npmjs.com/package/@datnguyennnx/localterm)

Your terminal should just be a browser tab.

Run `npx @datnguyennnx/localterm@latest start` and every browser tab is one shell. Open a new tab to spawn another. Close the tab to kill it. That's the whole product.

## Install

Run this command anywhere:

```bash
npx @datnguyennnx/localterm@latest start
```

This boots a local daemon and opens [`http://localterm.localhost:3417`](http://localterm.localhost:3417) in your browser. (`*.localhost` is reserved by [RFC 6761](https://datatracker.ietf.org/doc/html/rfc6761) and resolves to `127.0.0.1` in every modern browser, so no `/etc/hosts` edit needed.)

To install globally:

```bash
npm install -g @datnguyennnx/localterm
localterm start
```

## Usage

The mental model is **shell = browser tab**:

- **New tab** → new shell
- **Close tab** → shell dies immediately
- **Reload tab** → fresh shell (the prior one is gone)

No session ids, no URL slugs, no reconnects. If you want a long-lived shell that survives reloads, run `tmux` _inside_ localterm.

## CLI

```bash
localterm start [-p 3417] [-H 127.0.0.1] [--no-open] [--yolo] [--max-sessions <count>]
localterm stop
localterm status
localterm restart
```

State lives in `~/.localterm/` (PID, port, agent token, server log at `~/.localterm/server.log`).

## Agent Mode

localterm supports AI coding agents with structured output, command boundary detection, and a programmatic RPC interface. Pass `?mode=agent&token=<token>` when connecting via WebSocket, or use the built-in WS-RPC methods:

| Method | Description |
|--------|-------------|
| `spawn_session` | Create a new PTY session |
| `list_sessions` | List active sessions |
| `write_input` | Write data to a session |
| `read_output` | Read plain-text output |
| `wait_for_boundary` | Wait for command start/end |
| `exec` | Write command + wait for result |

Agent token is auto-generated at `~/.localterm/agent-token`. Pass `--yolo` to bypass the command denylist.

## Security

- Binds loopback hosts only: `127.0.0.1`, `localhost`, `*.localhost`, `::1`. Non-loopback values are rejected.
- `/api/*` and `/ws` enforce loopback `Host` and `Origin` headers to defeat DNS-rebinding attacks.
- Agent-mode connections require a token from `~/.localterm/agent-token`.
- One PTY per WebSocket. Closing the tab kills the shell — no orphaned processes.

## Credits

localterm was originally created by [Aiden Bai](https://github.com/aidenybai). MIT-licensed.
