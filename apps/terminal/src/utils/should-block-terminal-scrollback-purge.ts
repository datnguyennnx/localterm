import { TERMINAL_SCROLLBACK_PURGE_ERASE_DISPLAY_PARAM } from "@/lib/constants";

export const shouldBlockTerminalScrollbackPurge = (params: (number | number[])[]): boolean =>
  params[0] === TERMINAL_SCROLLBACK_PURGE_ERASE_DISPLAY_PARAM;
