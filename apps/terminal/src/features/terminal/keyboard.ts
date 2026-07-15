import type { Terminal } from "@xterm/xterm";
import {
  ENTER_KEY_CODE,
  KEYBOARD_MODIFIER_SHIFT_BIT,
  KITTY_KEYBOARD_DISAMBIGUATE_FLAG,
  KITTY_KEYBOARD_SET_MODE_AND_NOT,
  KITTY_KEYBOARD_SET_MODE_OR,
  KITTY_KEYBOARD_SET_MODE_REPLACE,
} from "@/lib/constants";
import { buildKittyKeySequence } from "@/utils/build-kitty-key-sequence";
import { extractKeyboardModifiers } from "@/utils/extract-keyboard-modifiers";
import { isFindShortcut } from "@/utils/is-find-shortcut";
import { shouldSuppressAltBufferWheel } from "@/utils/should-suppress-alt-buffer-wheel";

export interface KittyKeyboardState {
  getFlags: () => number;
}

export const setupKittyKeyboard = (terminal: Terminal): KittyKeyboardState => {
  // Kitty keyboard protocol (https://sw.kovidgoyal.net/kitty/keyboard-protocol/)
  // tracks a stack of flags so a TUI can push/pop reporting modes. We only
  // care that *some* flags are active when intercepting modifier+Enter so
  // shells (which never push flags) keep getting bare \r and don't see CSI u
  // garbage in their input. Stack always has at least one entry per spec.
  const flagStack: number[] = [0];
  const getFlags = (): number => flagStack[flagStack.length - 1] ?? 0;

  terminal.parser.registerCsiHandler({ prefix: ">", final: "u" }, (params) => {
    const first = params[0];
    const flags = typeof first === "number" ? first : 1;
    flagStack.push(flags);
    return true;
  });

  terminal.parser.registerCsiHandler({ prefix: "<", final: "u" }, (params) => {
    const first = params[0];
    const count = typeof first === "number" && first > 0 ? first : 1;
    for (let popIndex = 0; popIndex < count && flagStack.length > 1; popIndex += 1) {
      flagStack.pop();
    }
    return true;
  });

  terminal.parser.registerCsiHandler({ prefix: "=", final: "u" }, (params) => {
    const first = params[0];
    const second = params[1];
    // Sub-params (number arrays) aren't defined for kitty `=`. Bail rather
    // than coerce them to 0, which would silently nuke the stack entry.
    if (typeof first !== "number") return true;
    const flags = first;
    const mode =
      typeof second === "number" && second > 0 ? second : KITTY_KEYBOARD_SET_MODE_REPLACE;
    const top = flagStack.length - 1;
    const current = flagStack[top] ?? 0;
    if (mode === KITTY_KEYBOARD_SET_MODE_REPLACE) {
      flagStack[top] = flags;
    } else if (mode === KITTY_KEYBOARD_SET_MODE_OR) {
      flagStack[top] = current | flags;
    } else if (mode === KITTY_KEYBOARD_SET_MODE_AND_NOT) {
      flagStack[top] = current & ~flags;
    }
    return true;
  });

  return { getFlags };
};

export interface KeyHandlerDeps {
  isMac: boolean;
  getKittyFlags: () => number;
  openFindOverlay: () => void;
  sendInput: (data: string) => void;
  isTouchDevice: boolean;
}

export const attachCustomKeyHandler = (terminal: Terminal, deps: KeyHandlerDeps): void => {
  terminal.attachCustomKeyEventHandler((event) => {
    if (event.key === "Tab" && (event.metaKey || event.ctrlKey)) return false;
    if (isFindShortcut(event, deps.isMac)) {
      if (event.type === "keydown") {
        event.preventDefault();
        deps.openFindOverlay();
      }
      return false;
    }
    // xterm.js's default keyboard handler ignores Shift/Ctrl/Meta on Enter
    // and sends bare \r for all of them, so TUIs can't distinguish Shift+Enter
    // from Enter. Three-tier dispatch:
    //   1. Kitty disambiguate flag is active -> emit `CSI 13;mods+1 u` for any
    //      modifier+Enter (including Alt, since the TUI explicitly asked for
    //      the new protocol and prefers it over the legacy \e\r form).
    //   2. Plain Shift+Enter without kitty -> emit LF. This matches the
    //      iTerm2/VS Code/Terminal.app convention that Ink-based TUIs (Claude
    //      Code, Cursor Agent) read as "newline within input". Bash/zsh/fish
    //      bind \n to accept-line just like \r so shells are unaffected.
    //   3. Anything else (plain Enter, Alt-only, Ctrl/Cmd+Enter without
    //      kitty) -> fall through to xterm.js so app-specific bindings keep
    //      working.
    if (event.type === "keydown" && event.key === "Enter") {
      const modifierBits = extractKeyboardModifiers(event);
      const isKittyDisambiguateActive =
        (deps.getKittyFlags() & KITTY_KEYBOARD_DISAMBIGUATE_FLAG) !== 0;
      if (modifierBits !== 0 && isKittyDisambiguateActive) {
        event.preventDefault();
        deps.sendInput(buildKittyKeySequence(ENTER_KEY_CODE, modifierBits));
        return false;
      }
      if (modifierBits === KEYBOARD_MODIFIER_SHIFT_BIT) {
        event.preventDefault();
        deps.sendInput("\n");
        return false;
      }
    }
    return true;
  });
};

export const attachWheelHandler = (terminal: Terminal): void => {
  terminal.attachCustomWheelEventHandler((event) => {
    if (shouldSuppressAltBufferWheel(event, terminal)) {
      event.preventDefault();
      return false;
    }
    return true;
  });
};
