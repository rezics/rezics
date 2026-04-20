import { Autocomplete, Chip, TextField } from "@mui/material";
import type { SlugRef } from "@rezics/contract";
import type React from "react";
import { useState } from "react";
import { useTagSuggest } from "../../hooks/useTagSuggest";

export type TagPickerProps = {
  value: SlugRef[];
  onChange: (tags: SlugRef[]) => void;
  label?: string;
  placeholder?: string;
  size?: "small" | "medium";
};

// TODO(meili-tag-index): when the tag index ships, `useTagSuggest` will
// hit Meilisearch with slug-prefix match and return { slug, unitId, name }
// hits. No change needed here — TagPicker already maps them via suggestion.slug.

export const TagPicker: React.FC<TagPickerProps> = ({
  value,
  onChange,
  label,
  placeholder,
  size = "small",
}) => {
  const [inputValue, setInputValue] = useState("");
  const { suggestions } = useTagSuggest(inputValue);

  const commit = (raw: string) => {
    const tokens = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (tokens.length === 0) return;
    const seen = new Set(value.map((t) => t.slug));
    const added: SlugRef[] = [];
    for (const slug of tokens) {
      if (!seen.has(slug)) {
        seen.add(slug);
        added.push({ slug });
      }
    }
    if (added.length > 0) {
      onChange([...value, ...added]);
    }
    setInputValue("");
  };

  return (
    <Autocomplete
      multiple
      freeSolo
      size={size}
      value={value}
      options={suggestions}
      inputValue={inputValue}
      onInputChange={(_e, v, reason) => {
        if (reason === "input") {
          if (v.includes(",")) {
            commit(v);
          } else {
            setInputValue(v);
          }
        } else if (reason === "reset" || reason === "clear") {
          setInputValue("");
        }
      }}
      isOptionEqualToValue={(opt, val) => {
        const optSlug = typeof opt === "string" ? opt : opt.slug;
        const valSlug = typeof val === "string" ? val : val.slug;
        return optSlug === valSlug;
      }}
      getOptionLabel={(opt) => {
        if (typeof opt === "string") return opt;
        const name = (opt as { name?: string }).name;
        return name ?? opt.slug;
      }}
      onChange={(_e, newValue) => {
        const next: SlugRef[] = [];
        const seen = new Set<string>();
        for (const item of newValue) {
          const slug = typeof item === "string" ? item.trim() : item.slug;
          if (!slug || seen.has(slug)) continue;
          seen.add(slug);
          next.push(
            typeof item === "string"
              ? { slug }
              : { slug, unitId: item.unitId },
          );
        }
        onChange(next);
      }}
      renderTags={(tags, getTagProps) =>
        tags.map((tag, index) => {
          const props = getTagProps({ index });
          return (
            <Chip
              {...props}
              key={tag.slug}
              label={tag.slug}
              size={size}
              variant="outlined"
            />
          );
        })
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          size={size}
        />
      )}
    />
  );
};
