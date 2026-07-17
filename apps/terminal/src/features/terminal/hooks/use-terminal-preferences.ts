import { useCallback, useMemo, useRef, useState, type RefObject } from "react";
import type { FitAddon } from "@xterm/addon-fit";
import type { Terminal } from "@xterm/xterm";
import { LOCAL_FONT_ID } from "@/lib/constants";
import type { TerminalCursorStyle } from "@/features/terminal/cursor/terminal-cursor";
import { findTerminalFontById } from "@/features/terminal/fonts/terminal-fonts";
import { findTerminalThemeById } from "@/features/terminal/theme/terminal-themes";
import { clampTerminalFontSize } from "@/features/terminal/fonts/clamp-terminal-font-size";
import { clampTerminalLineHeight } from "@/features/terminal/fonts/clamp-terminal-line-height";
import {
  loadStoredLocalFontFamily,
  loadStoredTerminalCursorBlink,
  loadStoredTerminalCursorStyle,
  loadStoredTerminalFontId,
  loadStoredTerminalFontSize,
  loadStoredTerminalLineHeight,
  loadStoredTerminalScrollback,
  loadStoredTerminalScrollOnUserInput,
  loadStoredTerminalThemeId,
  storeLocalFontFamily,
  storeTerminalCursorBlink,
  storeTerminalCursorStyle,
  storeTerminalFontId,
  storeTerminalFontSize,
  storeTerminalLineHeight,
  storeTerminalScrollback,
  storeTerminalScrollOnUserInput,
  storeTerminalThemeId,
} from "@/storage/storage-slots";
import { buildNewTabUrl } from "../types";

export const useTerminalPreferences = (
  _terminalRef: RefObject<Terminal | null>,
  _fitAddonRef: RefObject<FitAddon | null>,
  liveCwd: string | null,
) => {
  const initialThemeIdRef = useRef<string>(loadStoredTerminalThemeId());
  const initialFontIdRef = useRef<string>(loadStoredTerminalFontId());
  const initialLocalFontFamilyRef = useRef<string | null>(loadStoredLocalFontFamily());
  const initialFontSizeRef = useRef<number>(loadStoredTerminalFontSize());
  const initialLineHeightRef = useRef<number>(loadStoredTerminalLineHeight());
  const initialCursorStyleRef = useRef<TerminalCursorStyle>(loadStoredTerminalCursorStyle());
  const initialCursorBlinkRef = useRef<boolean>(loadStoredTerminalCursorBlink());
  const initialScrollbackRef = useRef<number>(loadStoredTerminalScrollback());
  const initialScrollOnUserInputRef = useRef<boolean>(loadStoredTerminalScrollOnUserInput());

  const [activeThemeId, setActiveThemeId] = useState<string>(initialThemeIdRef.current);
  const [previewThemeId, setPreviewThemeId] = useState<string | null>(null);
  const [activeFontId, setActiveFontId] = useState<string>(initialFontIdRef.current);
  const [activeLocalFontFamily, setActiveLocalFontFamily] = useState<string | null>(
    initialLocalFontFamilyRef.current,
  );
  const [previewFontId, setPreviewFontId] = useState<string | null>(null);
  const [activeFontSize, setActiveFontSize] = useState<number>(initialFontSizeRef.current);
  const [activeLineHeight, setActiveLineHeight] = useState<number>(initialLineHeightRef.current);
  const [activeCursorStyle, setActiveCursorStyle] = useState<TerminalCursorStyle>(
    initialCursorStyleRef.current,
  );
  const [previewCursorStyle, setPreviewCursorStyle] = useState<TerminalCursorStyle | null>(null);
  const [activeCursorBlink, setActiveCursorBlink] = useState<boolean>(
    initialCursorBlinkRef.current,
  );
  const [activeScrollback, setActiveScrollback] = useState<number>(initialScrollbackRef.current);
  const [activeScrollOnUserInput, setActiveScrollOnUserInput] = useState<boolean>(
    initialScrollOnUserInputRef.current,
  );

  const effectiveThemeId = previewThemeId ?? activeThemeId;
  const effectiveTheme = useMemo(() => findTerminalThemeById(effectiveThemeId), [effectiveThemeId]);
  const effectiveFontId = previewFontId ?? activeFontId;
  const effectiveFont = useMemo(
    () => findTerminalFontById(effectiveFontId, activeLocalFontFamily),
    [effectiveFontId, activeLocalFontFamily],
  );
  const newTabUrl = useMemo(() => buildNewTabUrl(liveCwd), [liveCwd]);

  const handleThemeChange = useCallback((nextThemeId: string) => {
    setActiveThemeId(nextThemeId);
    setPreviewThemeId(null);
    storeTerminalThemeId(nextThemeId);
  }, []);

  const handlePreviewTheme = useCallback((themeId: string | null) => {
    setPreviewThemeId(themeId);
  }, []);

  const handleFontChange = useCallback((nextFontId: string) => {
    setActiveFontId(nextFontId);
    setPreviewFontId(null);
    storeTerminalFontId(nextFontId);
  }, []);

  const handlePreviewFont = useCallback((fontId: string | null) => {
    setPreviewFontId(fontId);
  }, []);

  const handleLocalFontChange = useCallback((family: string) => {
    setActiveLocalFontFamily(family);
    setActiveFontId(LOCAL_FONT_ID);
    setPreviewFontId(null);
    storeLocalFontFamily(family);
    storeTerminalFontId(LOCAL_FONT_ID);
  }, []);

  const handleFontSizeChange = useCallback((nextFontSize: number) => {
    const clamped = clampTerminalFontSize(nextFontSize);
    setActiveFontSize(clamped);
    storeTerminalFontSize(clamped);
  }, []);

  const handleLineHeightChange = useCallback((nextLineHeight: number) => {
    const clamped = clampTerminalLineHeight(nextLineHeight);
    setActiveLineHeight(clamped);
    storeTerminalLineHeight(clamped);
  }, []);

  const handleCursorStyleChange = useCallback((nextCursorStyle: TerminalCursorStyle) => {
    setActiveCursorStyle(nextCursorStyle);
    setPreviewCursorStyle(null);
    storeTerminalCursorStyle(nextCursorStyle);
  }, []);

  const handlePreviewCursor = useCallback((cursorStyle: TerminalCursorStyle | null) => {
    setPreviewCursorStyle(cursorStyle);
  }, []);

  const handleCursorBlinkChange = useCallback((nextCursorBlink: boolean) => {
    setActiveCursorBlink(nextCursorBlink);
    storeTerminalCursorBlink(nextCursorBlink);
  }, []);

  const handleScrollbackChange = useCallback((nextScrollback: number) => {
    setActiveScrollback(nextScrollback);
    storeTerminalScrollback(nextScrollback);
  }, []);

  const handleScrollOnUserInputChange = useCallback((nextScrollOnUserInput: boolean) => {
    setActiveScrollOnUserInput(nextScrollOnUserInput);
    storeTerminalScrollOnUserInput(nextScrollOnUserInput);
  }, []);

  return {
    // Refs
    initialThemeIdRef,
    initialFontIdRef,
    initialLocalFontFamilyRef,
    initialFontSizeRef,
    initialLineHeightRef,
    initialCursorStyleRef,
    initialCursorBlinkRef,
    initialScrollbackRef,
    initialScrollOnUserInputRef,
    // State + setters
    activeThemeId,
    setActiveThemeId,
    previewThemeId,
    setPreviewThemeId,
    activeFontId,
    setActiveFontId,
    activeLocalFontFamily,
    setActiveLocalFontFamily,
    previewFontId,
    setPreviewFontId,
    activeFontSize,
    setActiveFontSize,
    activeLineHeight,
    setActiveLineHeight,
    activeCursorStyle,
    setActiveCursorStyle,
    previewCursorStyle,
    setPreviewCursorStyle,
    activeCursorBlink,
    setActiveCursorBlink,
    activeScrollback,
    setActiveScrollback,
    activeScrollOnUserInput,
    setActiveScrollOnUserInput,
    // Derived
    effectiveTheme,
    effectiveFont,
    newTabUrl,
    // Callbacks
    handleThemeChange,
    handlePreviewTheme,
    handleFontChange,
    handlePreviewFont,
    handleLocalFontChange,
    handleFontSizeChange,
    handleLineHeightChange,
    handleCursorStyleChange,
    handlePreviewCursor,
    handleCursorBlinkChange,
    handleScrollbackChange,
    handleScrollOnUserInputChange,
  };
};
