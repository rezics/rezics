import SearchIcon from "@mui/icons-material/Search";
import { List, ListItemButton, ListItemText, Paper } from "@mui/material";
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
    <Paper
      elevation={3}
      tabIndex={-1}
      sx={{
        position: "absolute",
        top: "100%",
        left: 0,
        right: 0,
        mt: 0.5,
        zIndex: 20,
      }}
    >
      <List dense>
        {suggestions.map((item) => (
          <ListItemButton key={item} onClick={() => onSelect(item)}>
            <SearchIcon sx={{ mr: 1 }} />
            <ListItemText primary={item} />
          </ListItemButton>
        ))}
      </List>
    </Paper>
  );
};
