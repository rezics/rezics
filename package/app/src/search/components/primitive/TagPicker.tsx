import { Autocomplete, Chip, TextField } from "@mui/material";
import type { TagRef } from "@rezics/contract";
import type React from "react";
import { useState } from "react";
import { useTagSuggest } from "../../hooks/useTagSuggest";

export type TagPickerProps = {
  value: TagRef[];
  onChange: (tags: TagRef[]) => void;
  label?: string;
  placeholder?: string;
  size?: "small" | "medium";
};

const tagIdentity = (t: TagRef): string => t.unitId ?? t.slug ?? "";

const tagLabel = (t: TagRef): string =>
  t.name ?? t.slug ?? t.unitId ?? "";

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
    const seen = new Set(value.map(tagIdentity));
    const added: TagRef[] = [];
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
        const optId = typeof opt === "string" ? opt : tagIdentity(opt);
        const valId = typeof val === "string" ? val : tagIdentity(val);
        return optId === valId;
      }}
      getOptionLabel={(opt) => {
        if (typeof opt === "string") return opt;
        return tagLabel(opt);
      }}
      onChange={(_e, newValue) => {
        const next: TagRef[] = [];
        const seen = new Set<string>();
        for (const item of newValue) {
          if (typeof item === "string") {
            const slug = item.trim();
            if (!slug || seen.has(slug)) continue;
            seen.add(slug);
            next.push({ slug });
            continue;
          }
          const id = tagIdentity(item);
          if (!id || seen.has(id)) continue;
          seen.add(id);
          next.push({
            ...(item.unitId ? { unitId: item.unitId } : {}),
            ...(item.slug ? { slug: item.slug } : {}),
            ...(item.name ? { name: item.name } : {}),
          });
        }
        onChange(next);
      }}
      renderTags={(tags, getTagProps) =>
        tags.map((tag, index) => {
          const props = getTagProps({ index });
          return (
            <Chip
              {...props}
              key={tagIdentity(tag) || `idx-${index}`}
              label={tagLabel(tag)}
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
