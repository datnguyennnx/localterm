import type { Session } from "./session.js";

export class SessionRegistry {
  private readonly sessions = new Map<string, Session>();

  register(session: Session): void {
    this.sessions.set(session.id, session);
    session.onDestroy = () => {
      this.sessions.delete(session.id);
    };
  }

  unregister(session: Session): void {
    this.sessions.delete(session.id);
    session.onDestroy = null;
  }

  getById(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  size(): number {
    return this.sessions.size;
  }

  disposeAll(): void {
    for (const session of this.sessions.values()) {
      session.onDestroy = null;
      session.destroy();
    }
    this.sessions.clear();
  }
}
