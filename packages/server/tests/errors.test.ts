import { describe, expect, it } from "vite-plus/test";
import {
  WS_BACKPRESSURE_THRESHOLD_BYTES,
  WS_CLOSE_BACKPRESSURE,
  WS_CLOSE_CAPACITY_REACHED,
  WS_CLOSE_POLICY_VIOLATION,
} from "../src/constants.js";
import {
  ServerErrorException,
  formatServerError,
  isServerErrorException,
  serverError,
  type ServerError,
} from "../src/errors.js";

describe("serverError constructors", () => {
  it("nonLoopbackHost carries the host and stable code", () => {
    const error = serverError.nonLoopbackHost("evil.example.com");
    expect(error.kind).toBe("non-loopback-host");
    expect(error.code).toBe("E_LT_SERVER_NON_LOOPBACK_HOST");
    expect(error.host).toBe("evil.example.com");
  });

  it("listenFailed preserves the underlying cause", () => {
    const cause = new Error("EADDRINUSE: address already in use");
    const error = serverError.listenFailed("127.0.0.1", 3417, cause);
    expect(error.kind).toBe("listen-failed");
    expect(error.code).toBe("E_LT_SERVER_LISTEN_FAILED");
    expect(error.cause).toBe(cause);
  });

  it("loopbackDenied tags the rejected header and pins the WS close code", () => {
    const hostError = serverError.loopbackDenied("host", "evil.example.com");
    expect(hostError.reason).toBe("host");
    expect(hostError.observed).toBe("evil.example.com");
    expect(hostError.wsCloseCode).toBe(WS_CLOSE_POLICY_VIOLATION);

    const originError = serverError.loopbackDenied("origin", null);
    expect(originError.reason).toBe("origin");
    expect(originError.observed).toBeNull();
  });

  it("backpressure pins the threshold + close code", () => {
    const error = serverError.backpressure(9 * 1024 * 1024);
    expect(error.thresholdBytes).toBe(WS_BACKPRESSURE_THRESHOLD_BYTES);
    expect(error.wsCloseCode).toBe(WS_CLOSE_BACKPRESSURE);
  });

  it("sessionCapacity carries the limit and the capacity close code", () => {
    const error = serverError.sessionCapacity(64);
    expect(error.limit).toBe(64);
    expect(error.wsCloseCode).toBe(WS_CLOSE_CAPACITY_REACHED);
  });
});

describe("formatServerError", () => {
  it("formats every variant without throwing the exhaustiveness guard", () => {
    const variants: ServerError[] = [
      serverError.nonLoopbackHost("evil.example.com"),
      serverError.listenFailed("127.0.0.1", 3417, new Error("EADDRINUSE")),
      serverError.loopbackDenied("host", "evil.example.com"),
      serverError.loopbackDenied("origin", null),
      serverError.backpressure(9 * 1024 * 1024),
      serverError.sessionCapacity(64),
      serverError.frameRejected("inbound", "discriminated-union mismatch"),
      serverError.pathTraversal("/../etc/passwd"),
    ];
    for (const variant of variants) {
      const message = formatServerError(variant);
      expect(message).toBeTypeOf("string");
      expect(message.length).toBeGreaterThan(0);
    }
  });

  it("renders the underlying cause in the listen-failed message", () => {
    const message = formatServerError(
      serverError.listenFailed("127.0.0.1", 3417, new Error("EADDRINUSE")),
    );
    expect(message).toContain("127.0.0.1");
    expect(message).toContain("3417");
    expect(message).toContain("EADDRINUSE");
  });
});

describe("ServerErrorException", () => {
  it("preserves the typed error and chains the cause for variants that have one", () => {
    const cause = new Error("EADDRINUSE");
    const exception = new ServerErrorException(serverError.listenFailed("127.0.0.1", 3417, cause));
    expect(exception).toBeInstanceOf(Error);
    expect(exception.name).toBe("ServerErrorException");
    expect(exception.error.kind).toBe("listen-failed");
    expect(exception.cause).toBe(cause);
  });

  it("does not set cause when the variant has none", () => {
    const exception = new ServerErrorException(serverError.nonLoopbackHost("evil.example.com"));
    expect(exception.cause).toBeUndefined();
  });

  it("isServerErrorException narrows correctly", () => {
    const exception = new ServerErrorException(serverError.sessionCapacity(64));
    expect(isServerErrorException(exception)).toBe(true);
    expect(isServerErrorException(new Error("plain"))).toBe(false);
    expect(isServerErrorException(null)).toBe(false);
    expect(isServerErrorException("string")).toBe(false);
  });
});
