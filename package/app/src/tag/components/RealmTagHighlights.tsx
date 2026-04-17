import { Box, Chip, Collapse, Stack, Typography } from "@mui/material";
import type React from "react";
import { useState } from "react";

interface RealmHighlight {
  realmUnitId: string;
  realmName: string;
  tags: string[];
}

interface RealmTagHighlightsProps {
  realmHighlights: RealmHighlight[];
}

export const RealmTagHighlights: React.FC<RealmTagHighlightsProps> = ({
  realmHighlights,
}) => {
  const [expanded, setExpanded] = useState(false);

  if (realmHighlights.length === 0) return null;

  return (
    <Box>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ cursor: "pointer" }}
        onClick={() => setExpanded(!expanded)}
      >
        Realm highlights ({realmHighlights.length})
      </Typography>
      <Collapse in={expanded}>
        <Stack spacing={1} mt={1}>
          {realmHighlights.map((rh) => (
            <Box key={rh.realmUnitId}>
              <Typography variant="caption" fontWeight={600}>
                {rh.realmName}
              </Typography>
              <Stack
                direction="row"
                spacing={0.5}
                flexWrap="wrap"
                useFlexGap
                mt={0.5}
              >
                {rh.tags.map((tagId) => (
                  <Chip
                    key={tagId}
                    label={tagId}
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      </Collapse>
    </Box>
  );
};
