import { useCallback, useMemo, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  SEED_TAG_IDS,
  SEED_TAG_TITLES,
  type SeedTagName,
  SEED_TAG_NAMES,
} from "@rezics/contract";
import type { CollectionStatusResponse, ShelfSummaryDTO } from "@rezics/api/shelf";

interface CollectionModalProps {
  open: boolean;
  onClose: () => void;
  onCollect: (shelfIds: string[], keywords: string[], independent?: boolean) => void;
  shelves: ShelfSummaryDTO[];
  status?: CollectionStatusResponse;
  userKeywords: string[];
  isCollecting: boolean;
  isLoading: boolean;
  isReview?: boolean;
}

export function CollectionModal({
  open,
  onClose,
  onCollect,
  shelves,
  status,
  userKeywords,
  isCollecting,
  isLoading,
  isReview = false,
}: CollectionModalProps) {
  const [selectedShelves, setSelectedShelves] = useState<Set<string>>(new Set());
  const [keywords, setKeywords] = useState<string[]>([]);
  const [filterTag, setFilterTag] = useState<SeedTagName | null>(null);
  const [independent, setIndependent] = useState(false);

  // Initialize selected shelves from status
  useMemo(() => {
    if (status?.shelves) {
      setSelectedShelves(new Set(status.shelves.map((s) => s.id)));
    }
  }, [status]);

  const filteredShelves = useMemo(() => {
    if (!filterTag) return shelves;
    const tagId = SEED_TAG_IDS[filterTag];
    return shelves.filter(
      (s) => s.tags?.some((t) => t.tagUnitId === tagId),
    );
  }, [shelves, filterTag]);

  const toggleShelf = useCallback((shelfId: string) => {
    setSelectedShelves((prev) => {
      const next = new Set(prev);
      if (next.has(shelfId)) next.delete(shelfId);
      else next.add(shelfId);
      return next;
    });
  }, []);

  const handleSave = useCallback(() => {
    onCollect([...selectedShelves], keywords, independent);
  }, [selectedShelves, keywords, independent, onCollect]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Collect</DialogTitle>
      <DialogContent dividers>
        {isLoading ? (
          <Stack alignItems="center" py={3}>
            <CircularProgress size={24} />
          </Stack>
        ) : (
          <Stack spacing={2}>
            {/* Content-type filter chips */}
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              <Chip
                label="All"
                size="small"
                variant={filterTag === null ? "filled" : "outlined"}
                onClick={() => setFilterTag(null)}
              />
              {SEED_TAG_NAMES.map((name) => (
                <Chip
                  key={name}
                  label={SEED_TAG_TITLES[name]}
                  size="small"
                  variant={filterTag === name ? "filled" : "outlined"}
                  onClick={() => setFilterTag(filterTag === name ? null : name)}
                />
              ))}
            </Stack>

            {/* Shelf list with checkboxes */}
            <List dense disablePadding>
              {filteredShelves.length === 0 ? (
                <Typography variant="body2" color="text.secondary" px={1}>
                  No shelves found
                </Typography>
              ) : (
                filteredShelves.map((shelf) => (
                  <ListItem
                    key={shelf.unitId}
                    disablePadding
                    sx={{ cursor: "pointer" }}
                    onClick={() => toggleShelf(shelf.unitId)}
                  >
                    <Checkbox
                      size="small"
                      checked={selectedShelves.has(shelf.unitId)}
                      tabIndex={-1}
                    />
                    <ListItemText
                      primary={shelf.title ?? "Untitled"}
                      secondary={`${shelf.itemCount} items`}
                    />
                  </ListItem>
                ))
              )}
            </List>

            {/* Keywords input */}
            <Autocomplete
              multiple
              freeSolo
              size="small"
              options={userKeywords}
              value={keywords}
              onChange={(_, newValue) => setKeywords(newValue)}
              renderTags={(value, getTagProps) =>
                value.map((kw, index) => (
                  <Chip
                    {...getTagProps({ index })}
                    key={kw}
                    label={kw}
                    size="small"
                  />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  variant="standard"
                  placeholder="Add keywords..."
                />
              )}
            />

            {/* Dual collection mode for reviews */}
            {isReview && (
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={independent}
                    onChange={(e) => setIndependent(e.target.checked)}
                  />
                }
                label={
                  <Typography variant="body2">
                    Collect as independent unit
                  </Typography>
                }
              />
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} size="small">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          size="small"
          disabled={isCollecting || selectedShelves.size === 0}
        >
          {isCollecting ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
