import SearchIcon from "@mui/icons-material/Search";
import {
  Checkbox,
  Chip,
  FormControlLabel,
  IconButton,
  TextField,
} from "@mui/material";
import { useRouterState } from "@tanstack/react-router";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  IsLicensedInfo,
  NSFWInfo,
} from "@/book-edit/component/Metadata/BookMetadataEditor";
import type { SearchInfo } from "../model/searchInfo";
import { normalizeSearchInfo } from "../model/searchInfo";
import { parseBookSearchParams } from "../util/searchQuery";

export type SearchInputViewProps = {
  value: SearchInfo;
  onValueChange: (value: SearchInfo) => void;
  onSearch: () => void;
  onAddTag?: (tag: string) => void;
  placeholder?: string; // already translated text
  tagGroups?: Record<string, string[]>; // group name -> tags
  hiddenWordCountFilter?: boolean;
};

export const SearchInputView: React.FC<SearchInputViewProps> = ({
  value,
  onValueChange,
  onSearch,
  onAddTag,
  placeholder,
  tagGroups,
  hiddenWordCountFilter = false,
}) => {
  const { t } = useTranslation();
  const groups = useMemo(
    () =>
      tagGroups ?? {
        presetTags: [
          "fiction",
          "nonfiction",
          "mystery",
          "romance",
          "history",
          "science",
          "fantasy",
          "philosophy",
        ],
      },
    [tagGroups],
  );

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSearch();
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <TextField
          fullWidth
          size="small"
          label={placeholder ?? t("placeholders.search_books")}
          placeholder="Title, ISBN, Author, Publisher, Producer"
          value={value.keyword ?? ""}
          onChange={(e) => onValueChange({ ...value, keyword: e.target.value })}
          onKeyDown={handleKeyDown}
        />
        <IconButton
          color="primary"
          aria-label={t("accessibility.search")}
          onClick={onSearch}
        >
          <SearchIcon />
        </IconButton>
      </div>
      <div className="flex items-center gap-2 mt-4">
        {/* TAGS */}
        <div className="flex-1 min-w-0">
          <TextField
            fullWidth
            size="small"
            label="Tags"
            placeholder="Click tags below or enter tags separated by commas"
            value={
              value.tags
                ? value.tags.filter((tag) => tag.trim() !== "").join(", ")
                : ""
            }
            onChange={(e) =>
              onValueChange({ ...value, tags: e.target.value.split(", ") })
            }
            onKeyDown={handleKeyDown}
          />
        </div>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-2 shrink-0">
          {!hiddenWordCountFilter && (
            <TextField
              size="small"
              label="Word Count"
              placeholder="10000-20000"
              className="w-40"
              value={value.textLength ?? ""}
              onChange={(e) =>
                onValueChange({ ...value, textLength: e.target.value })
              }
              onKeyDown={handleKeyDown}
            />
          )}

          <FormControlLabel
            className="m-0"
            control={
              <Checkbox
                checked={!!value.nsfw}
                onChange={(e) =>
                  onValueChange({ ...value, nsfw: e.target.checked })
                }
              />
            }
            label={<NSFWInfo tooltipTitle={t("search.tooltips.nsfw")} />}
          />

          <FormControlLabel
            className="m-0"
            control={
              <Checkbox
                checked={!!value.isLicensed}
                onChange={(e) =>
                  onValueChange({ ...value, isLicensed: e.target.checked })
                }
              />
            }
            label={
              <IsLicensedInfo tooltipTitle={t("search.tooltips.licensed")} />
            }
          />
        </div>
      </div>
      {/* <div className="flex items-center gap-2 mt-4">
        <TextField
          fullWidth
          size="small"
          label={'User'}
          placeholder='User or Publisher: "John"'
          value={value.user ?? ''}
          onChange={e => onValueChange({...value, user: e.target.value})}
          onKeyDown={handleKeyDown}
        />
      </div> */}

      {groups && Object.keys(groups).length > 0 && (
        <div className="mt-4">
          {Object.entries(groups).map(([key, tags]) => (
            <div key={key} className="flex flex-wrap gap-2 mb-2">
              <div className="font-bold">{key}</div>
              <div>
                {tags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    clickable
                    variant="outlined"
                    onClick={() => onAddTag?.(tag)}
                    size="small"
                    className="cursor-pointer !mr-2"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export type SearchInputProps = {
  onSearch: (info: SearchInfo) => void;
  defaultValue?: SearchInfo;
  placeholder?: string;
  tagGroups?: Record<string, string[]>;
  hiddenWordCountFilter?: boolean;
};

export const SearchInput: React.FC<SearchInputProps> = ({
  onSearch,
  defaultValue = { keyword: "", tags: [] },
  placeholder,
  tagGroups,
  hiddenWordCountFilter = false,
}) => {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search ?? "" });
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (pathname === "/book") {
      const currentSearch = parseBookSearchParams(searchParams.toString());
      setValue(currentSearch);
      onSearch(currentSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams.toString, onSearch]);

  const handleSearch = () => {
    onSearch(normalizeSearchInfo(value));
  };

  const handleAddTag = (tag: string) => {
    setValue({ ...value, tags: [...(value.tags ?? []), tag] });
  };

  return (
    <SearchInputView
      value={value}
      onValueChange={setValue}
      onSearch={handleSearch}
      onAddTag={handleAddTag}
      placeholder={placeholder}
      tagGroups={tagGroups}
      hiddenWordCountFilter={hiddenWordCountFilter}
    />
  );
};
