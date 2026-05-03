import { act, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { App } from "../src/app";

let lastTerminalProps: { onModalOpenChange?: (open: boolean) => void } | null = null;
let setMockModalOpen: ((open: boolean) => void) | null = null;

vi.mock("../src/components/terminal", () => ({
  Terminal: (props: { onModalOpenChange?: (open: boolean) => void }) => {
    lastTerminalProps = props;
    useEffect(() => {
      setMockModalOpen = (open: boolean) => props.onModalOpenChange?.(open);
      return () => {
        setMockModalOpen = null;
      };
    }, [props]);
    return <div data-testid="terminal" />;
  },
}));

afterEach(() => {
  vi.restoreAllMocks();
  lastTerminalProps = null;
  setMockModalOpen = null;
});

const armBeforeUnload = async () => {
  await screen.findByTestId("terminal");
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
};

const dispatchBeforeUnload = () => {
  const event = new Event("beforeunload", { cancelable: true });
  const preventDefaultSpy = vi.spyOn(event, "preventDefault");
  window.dispatchEvent(event);
  return preventDefaultSpy;
};

describe("App", () => {
  it("renders the terminal immediately without contacting the server", async () => {
    render(<App />);
    expect(await screen.findByTestId("terminal")).toBeDefined();
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

  it("warns on unload while the shell is alive", async () => {
    render(<App />);
    await armBeforeUnload();

    const preventDefaultSpy = dispatchBeforeUnload();
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it("does not warn on unload while the shell-ended/disconnect modal is open", async () => {
    render(<App />);
    await armBeforeUnload();

    expect(lastTerminalProps?.onModalOpenChange).toBeTypeOf("function");

    act(() => {
      setMockModalOpen?.(true);
    });

    const preventDefaultSpy = dispatchBeforeUnload();
    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });

  it("re-arms the unload warning if the modal closes (e.g. retry succeeds)", async () => {
    render(<App />);
    await armBeforeUnload();

    act(() => {
      setMockModalOpen?.(true);
    });
    act(() => {
      setMockModalOpen?.(false);
    });

    const preventDefaultSpy = dispatchBeforeUnload();
    expect(preventDefaultSpy).toHaveBeenCalled();
  });
});
