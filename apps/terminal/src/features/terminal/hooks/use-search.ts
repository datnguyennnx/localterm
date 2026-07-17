import { useCallback, useRef, useState } from "react";
import type { RefObject } from "react";
import type { SearchAddon } from "@xterm/addon-search";
import { isFindShortcut } from "@/features/terminal/keyboard/is-find-shortcut";
import type { SearchResultState } from "@/features/terminal/types";

export interface UseSearchReturn {
  isSearchOpen: boolean;
  setIsSearchOpen: (value: boolean) => void;
  searchOpenAttempt: number;
  searchQuery: string;
  searchResults: SearchResultState;
  setSearchResults: (results: SearchResultState) => void;
  openSearchOverlayRef: RefObject<(() => void) | null>;
  openSearchOverlay: () => void;
  handleSearchInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleSearchKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  handleSearchClose: () => void;
  findNextMatch: (query: string) => void;
  findPreviousMatch: (query: string) => void;
}

export const useSearch = (
  searchAddonRef: RefObject<SearchAddon | null>,
  refocusTerminalRef: RefObject<(() => void) | null>,
  isMac: boolean,
): UseSearchReturn => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchOpenAttempt, setSearchOpenAttempt] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultState>({
    resultIndex: -1,
    resultCount: 0,
  });
  const openSearchOverlayRef = useRef<(() => void) | null>(null);

  const findNextMatch = useCallback(
    (query: string) => {
      if (!query) {
        searchAddonRef.current?.clearDecorations();
        setSearchResults({ resultIndex: -1, resultCount: 0 });
        return;
      }
      searchAddonRef.current?.findNext(query);
    },
    [searchAddonRef],
  );

  const findPreviousMatch = useCallback(
    (query: string) => {
      if (!query) return;
      searchAddonRef.current?.findPrevious(query);
    },
    [searchAddonRef],
  );

  const handleSearchClose = useCallback(() => {
    setIsSearchOpen(false);
    setSearchQuery("");
    setSearchResults({ resultIndex: -1, resultCount: 0 });
    searchAddonRef.current?.clearDecorations();
    refocusTerminalRef.current?.();
  }, [searchAddonRef, refocusTerminalRef]);

  const openSearchOverlay = useCallback(() => {
    setIsSearchOpen(true);
    setSearchOpenAttempt((previous) => previous + 1);
  }, []);
  openSearchOverlayRef.current = openSearchOverlay;

  const handleSearchInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = event.target.value;
      setSearchQuery(next);
      findNextMatch(next);
    },
    [findNextMatch],
  );

  const handleSearchKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (isFindShortcut(event.nativeEvent, isMac)) {
        event.preventDefault();
        event.currentTarget.select();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        handleSearchClose();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        if (event.shiftKey) {
          findPreviousMatch(searchQuery);
        } else {
          findNextMatch(searchQuery);
        }
      }
    },
    [handleSearchClose, findNextMatch, findPreviousMatch, isMac, searchQuery],
  );

  return {
    isSearchOpen,
    setIsSearchOpen,
    searchOpenAttempt,
    searchQuery,
    searchResults,
    setSearchResults,
    openSearchOverlayRef,
    openSearchOverlay,
    handleSearchInputChange,
    handleSearchKeyDown,
    handleSearchClose,
    findNextMatch,
    findPreviousMatch,
  };
};
