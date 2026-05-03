import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./app";

vi.mock("./components/terminal", () => ({
  Terminal: () => <div data-testid="terminal" />,
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("App", () => {
  it("renders the terminal immediately without contacting the server", async () => {
    render(<App />);
    expect(await screen.findByTestId("terminal")).toBeInTheDocument();
  });

  it("only arms beforeunload after the first keystroke in the tab", async () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    render(<App />);

    await screen.findByTestId("terminal");
    await waitFor(() => {
      const armed = addSpy.mock.calls.some(([eventName]) => eventName === "keydown");
      expect(armed).toBe(true);
    });

    const beforeKeystroke = addSpy.mock.calls.some(([eventName]) => eventName === "beforeunload");
    expect(beforeKeystroke).toBe(false);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));

    await waitFor(() => {
      const afterKeystroke = addSpy.mock.calls.some(([eventName]) => eventName === "beforeunload");
      expect(afterKeystroke).toBe(true);
    });
  });
});
