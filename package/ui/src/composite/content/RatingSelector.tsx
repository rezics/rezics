import type { ContentRating } from "@rezics/contract";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import type { SelectChangeEvent } from "@mui/material/Select";

const RATING_OPTIONS: readonly { value: ContentRating; label: string }[] = [
  { value: "GENERAL", label: "General" },
  { value: "R_15", label: "R-15" },
  { value: "R_18", label: "R-18" },
  { value: "R_18G", label: "R-18G" },
];

export interface RatingSelectorProps {
  value: ContentRating;
  onChange: (next: ContentRating) => void;
  label?: string;
  helperText?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: "small" | "medium";
}

export function RatingSelector({
  value,
  onChange,
  label = "Content rating",
  helperText,
  disabled,
  fullWidth = true,
  size = "small",
}: RatingSelectorProps) {
  const handleChange = (event: SelectChangeEvent<ContentRating>) => {
    onChange(event.target.value as ContentRating);
  };

  return (
    <FormControl fullWidth={fullWidth} size={size} disabled={disabled}>
      <InputLabel id="rating-selector-label">{label}</InputLabel>
      <Select
        labelId="rating-selector-label"
        value={value}
        label={label}
        onChange={handleChange}
      >
        {RATING_OPTIONS.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>
            {opt.label}
          </MenuItem>
        ))}
      </Select>
      {helperText ? <FormHelperText>{helperText}</FormHelperText> : null}
    </FormControl>
  );
}
