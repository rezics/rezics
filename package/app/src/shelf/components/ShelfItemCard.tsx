import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ShelfItemDTO } from "@rezics/api/shelf";

interface ShelfItemCardProps {
  item: ShelfItemDTO;
}

export function ShelfItemCard({ item }: ShelfItemCardProps) {
  const shortRef =
    item.itemRef.length > 12
      ? `${item.itemRef.slice(0, 8)}…${item.itemRef.slice(-4)}`
      : item.itemRef;

  return (
    <Stack direction="row" spacing={1} alignItems="center" py={0.5} px={1}>
      <Chip label={item.kind} size="small" variant="outlined" />
      <Typography variant="caption" color="text.secondary" noWrap>
        {shortRef}
      </Typography>
    </Stack>
  );
}
