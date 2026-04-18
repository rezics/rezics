import Box from "@mui/material/Box";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import type React from "react";

interface ScoreInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  max?: number;
  size?: "small" | "medium";
}

export const ScoreInput: React.FC<ScoreInputProps> = ({
  value,
  onChange,
  max = 10,
  size = "small",
}) => {
  const scores = Array.from({ length: max }, (_, i) => i + 1);

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" mb={0.5}>
        Score
      </Typography>
      <ToggleButtonGroup
        value={value}
        exclusive
        size={size}
        onChange={(_, v) => onChange(v)}
        sx={{ flexWrap: "wrap", gap: 0.5 }}
      >
        {scores.map((s) => (
          <ToggleButton key={s} value={s} sx={{ minWidth: 36, px: 1 }}>
            {s}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
};
