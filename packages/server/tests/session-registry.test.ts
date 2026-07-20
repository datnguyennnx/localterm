import { describe, expect, it, vi } from "vite-plus/test";
import { SessionRegistry } from "../src/session/session-registry.js";

let mockSessionId = 0;
const createMockSession = () =>
  ({
    id: `mock-session-${mockSessionId++}`,
    destroy: vi.fn(),
  }) as unknown as import("../src/session/session.js").Session;

describe("SessionRegistry", () => {
  it("starts empty", () => {
    const registry = new SessionRegistry();
    expect(registry.size()).toBe(0);
  });

  it("register adds a session", () => {
    const registry = new SessionRegistry();
    const sessionA = createMockSession();
    registry.register(sessionA);
    expect(registry.size()).toBe(1);
  });

  it("register is idempotent for the same session reference", () => {
    const registry = new SessionRegistry();
    const sessionA = createMockSession();
    registry.register(sessionA);
    registry.register(sessionA);
    expect(registry.size()).toBe(1);
  });

  it("unregister removes a session", () => {
    const registry = new SessionRegistry();
    const sessionA = createMockSession();
    registry.register(sessionA);
    registry.unregister(sessionA);
    expect(registry.size()).toBe(0);
  });

  it("unregister is a no-op for an unregistered session", () => {
    const registry = new SessionRegistry();
    const sessionA = createMockSession();
    expect(() => registry.unregister(sessionA)).not.toThrow();
    expect(registry.size()).toBe(0);
  });

  it("unregister removes only the specified session", () => {
    const registry = new SessionRegistry();
    const sessionA = createMockSession();
    const sessionB = createMockSession();
    registry.register(sessionA);
    registry.register(sessionB);
    registry.unregister(sessionA);
    expect(registry.size()).toBe(1);
  });

  it("disposeAll calls destroy on every registered session and clears the registry", () => {
    const registry = new SessionRegistry();
    const sessionA = createMockSession();
    const sessionB = createMockSession();
    registry.register(sessionA);
    registry.register(sessionB);
    registry.disposeAll();
    expect(sessionA.destroy).toHaveBeenCalledTimes(1);
    expect(sessionB.destroy).toHaveBeenCalledTimes(1);
    expect(registry.size()).toBe(0);
  });

  it("disposeAll is safe to call on an empty registry", () => {
    const registry = new SessionRegistry();
    expect(() => registry.disposeAll()).not.toThrow();
    expect(registry.size()).toBe(0);
  });

  it("supports many sessions up to the configured limit", () => {
    const registry = new SessionRegistry();
    const sessions = Array.from({ length: 64 }, () => createMockSession());
    for (const s of sessions) registry.register(s);
    expect(registry.size()).toBe(64);
  });

  it("handles interleaved register and unregister", () => {
    const registry = new SessionRegistry();
    const sessions = Array.from({ length: 5 }, () => createMockSession());
    for (const s of sessions) registry.register(s);
    registry.unregister(sessions[1]);
    registry.unregister(sessions[3]);
    expect(registry.size()).toBe(3);
    registry.register(createMockSession());
    expect(registry.size()).toBe(4);
  });

  describe("getById", () => {
    it("returns the session registered with that id", () => {
      const registry = new SessionRegistry();
      const session = createMockSession();
      registry.register(session);
      expect(registry.getById(session.id)).toBe(session);
      registry.disposeAll();
    });

    it("returns undefined for an unknown id", () => {
      const registry = new SessionRegistry();
      expect(registry.getById("nonexistent")).toBeUndefined();
      registry.disposeAll();
    });

    it("returns undefined after the session is unregistered", () => {
      const registry = new SessionRegistry();
      const session = createMockSession();
      registry.register(session);
      registry.unregister(session);
      expect(registry.getById(session.id)).toBeUndefined();
      registry.disposeAll();
    });
  });
});
