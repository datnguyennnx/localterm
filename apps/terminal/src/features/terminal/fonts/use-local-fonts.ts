import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { isLocalFontAccessSupported, queryLocalFonts } from "./query-local-fonts";
import { loadLocalFontPermissionState } from "./load-local-font-permission-state";

export type PickerState =
  | { kind: "loading" }
  | { kind: "unsupported" }
  | { kind: "denied" }
  | { kind: "prompt" }
  | { kind: "ready"; families: readonly string[] };

const filterFamilies = (families: readonly string[], query: string): readonly string[] => {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return families;
  return families.filter((family) => family.toLowerCase().includes(trimmed));
};

interface UseLocalFontsOptions {
  open: boolean;
  onFontSelect: (family: string) => void;
}

export const useLocalFonts = ({ open, onFontSelect }: UseLocalFontsOptions) => {
  const [state, setState] = useState<PickerState>({ kind: "loading" });
  const [searchQuery, setSearchQuery] = useState("");
  const deferredQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    if (!open) return;
    setSearchQuery("");
    let cancelled = false;
    setState({ kind: "loading" });
    void (async () => {
      if (!isLocalFontAccessSupported()) {
        if (!cancelled) setState({ kind: "unsupported" });
        return;
      }
      const permission = await loadLocalFontPermissionState();
      if (cancelled) return;
      if (permission === "granted") {
        const families = await queryLocalFonts();
        if (!cancelled) setState({ kind: "ready", families });
      } else if (permission === "denied") {
        setState({ kind: "denied" });
      } else if (permission === "unsupported") {
        // Permissions API doesn't know about local-fonts even though
        // queryLocalFonts exists — ask directly, the API will prompt.
        setState({ kind: "prompt" });
      } else {
        setState({ kind: "prompt" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const requestPermission = useCallback(async () => {
    setState({ kind: "loading" });
    const families = await queryLocalFonts();
    if (families.length === 0) {
      setState({ kind: "denied" });
      return;
    }
    setState({ kind: "ready", families });
  }, []);

  const handleApply = useCallback(
    (family: string) => {
      onFontSelect(family);
    },
    [onFontSelect],
  );

  const filteredFamilies = useMemo(() => {
    if (state.kind !== "ready") return [];
    return filterFamilies(state.families, deferredQuery);
  }, [state.kind, state.kind === "ready" ? state.families : undefined, deferredQuery]);

  return {
    state,
    searchQuery,
    setSearchQuery,
    deferredQuery,
    filteredFamilies,
    handleApply,
    requestPermission,
  };
};
