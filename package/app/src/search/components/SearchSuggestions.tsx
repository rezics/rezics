import { Search as SearchIcon } from "lucide-react";
import type React from "react";

interface SearchSuggestionsProps {
  keyword: string;
  onSelect: (keyword: string) => void;
}

export const SearchSuggestions: React.FC<SearchSuggestionsProps> = ({
  keyword,
  onSelect,
}) => {
  if (!keyword.trim()) {
    return null;
  }

  /**
   * currently:
   * only echo user input
   */
  const suggestions = [keyword];

  return (
    <div
      tabIndex={-1}
      className="absolute top-full left-0 right-0 mt-1 z-20 bg-rezics-color-bg-elevated rounded-md shadow-lg"
    >
      <ul className="py-1">
        {suggestions.map((item) => (
          <li key={item}>
            <button
              type="button"
              onClick={() => onSelect(item)}
              className="flex w-full items-center px-4 py-1.5 text-left text-sm hover:bg-rezics-color-bg-hover"
            >
              <SearchIcon style={{ marginRight: "8px" }} />
              <span>{item}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
