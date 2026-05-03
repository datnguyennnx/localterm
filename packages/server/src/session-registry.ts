import type { Session } from "./session.js";

export class SessionRegistry {
  private readonly sessions = new Set<Session>();

  register(session: Session): void {
    this.sessions.add(session);
  }

  unregister(session: Session): void {
    this.sessions.delete(session);
  }

  size(): number {
    return this.sessions.size;
  }

  disposeAll(): void {
    for (const session of this.sessions) {
      session.dispose();
    }
    this.sessions.clear();
  }
}
