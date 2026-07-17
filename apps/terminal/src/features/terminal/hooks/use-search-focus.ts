import { useEffect, type RefObject } from "react";

export const useSearchFocus = (
  isSearchOpen: boolean,
  searchOpenAttempt: number,
  searchInputRef: RefObject<HTMLInputElement | null>,
): void => {
  useEffect(() => {
    if (!isSearchOpen) return;
    const input = searchInputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [isSearchOpen, searchOpenAttempt, searchInputRef]);
};
