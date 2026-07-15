import type { RefObject, KeyboardEvent } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import type { SearchResultState } from "./types";

interface SearchOverlayProps {
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  searchResults: SearchResultState;
  onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onFindNext: () => void;
  onFindPrevious: () => void;
}

export const SearchOverlay = ({
  searchInputRef,
  searchQuery,
  searchResults,
  onSearchChange,
  onKeyDown,
  onFindNext,
  onFindPrevious,
}: SearchOverlayProps) => {
  const matchLabel =
    searchResults.resultCount === 0
      ? "0/0"
      : `${searchResults.resultIndex + 1}/${searchResults.resultCount}`;

  return (
    <InputGroup
      role="search"
      aria-label="find in terminal"
      className="absolute top-2 right-3 z-10 w-[min(20rem,calc(100vw-1.5rem))] border-border/60 bg-background/70 text-muted-foreground shadow-xs backdrop-blur-md dark:bg-background/70"
    >
      <InputGroupInput
        ref={searchInputRef}
        type="search"
        value={searchQuery}
        onChange={onSearchChange}
        onKeyDown={onKeyDown}
        placeholder="Find"
        aria-label="find query"
        className="text-xs"
      />
      <InputGroupAddon align="inline-end">
        <InputGroupText role="status" aria-label="match count" className="text-xs tabular-nums">
          {matchLabel}
        </InputGroupText>
        <InputGroupButton
          size="icon-xs"
          onClick={onFindPrevious}
          disabled={searchResults.resultCount === 0}
          aria-label="previous match"
        >
          <ChevronUp />
        </InputGroupButton>
        <InputGroupButton
          size="icon-xs"
          onClick={onFindNext}
          disabled={searchResults.resultCount === 0}
          aria-label="next match"
        >
          <ChevronDown />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
};
