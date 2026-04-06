import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";

export interface ExternalImageGuideConfig {
  name: string;
  url: string;
  steps: string[];
}

interface ExternalImageGuideProps extends ExternalImageGuideConfig {
  onInsert: (url: string, alt?: string) => void;
}

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function ExternalImageGuide({
  name,
  url,
  steps,
  onInsert,
}: ExternalImageGuideProps) {
  const [imageUrl, setImageUrl] = useState("");
  const valid = isValidUrl(imageUrl);

  const handleSubmit = () => {
    if (valid) {
      onInsert(imageUrl);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, p: 1 }}>
      <Typography variant="body2" fontWeight={500}>
        Upload your image to{" "}
        <Link href={url} target="_blank" rel="noopener noreferrer">
          {name}
        </Link>
        , then paste the direct image URL below.
      </Typography>
      <Box component="ol" sx={{ pl: 2.5, m: 0, "& li": { mb: 0.5 } }}>
        {steps.map((step, i) => (
          <Typography
            component="li"
            variant="body2"
            color="text.secondary"
            key={i}
          >
            {step}
          </Typography>
        ))}
      </Box>
      <Box sx={{ display: "flex", gap: 1 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="https://..."
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
        />
        <Button
          variant="contained"
          size="small"
          onClick={handleSubmit}
          disabled={!valid}
        >
          Insert
        </Button>
      </Box>
    </Box>
  );
}
