import Chip from "@mui/material/Chip";
import type { ShelfItemDTO, ShelfView } from "@rezics/api/shelf";
import { ShelfItemCard } from "./ShelfItemCard";

interface ShelfItemRendererProps {
  item: ShelfItemDTO;
  title?: string;
  viewMode: ShelfView;
}

export function ShelfItemRenderer({
  item,
  title,
  viewMode,
}: ShelfItemRendererProps) {
  switch (item.kind) {
    case "tag":
      return (
        <Chip
          size="small"
          label={title ?? item.itemRef}
          variant="outlined"
          sx={{ mr: 0.5, mb: 0.5 }}
        />
      );
    case "book":
    case "review":
    case "quote":
    case "post":
    case "chapter":
    case "realm":
    case "image":
    case "video":
    case "media":
    case "game":
    case "link":
      return <ShelfItemCard item={item} title={title} viewMode={viewMode} />;
    default:
      return <ShelfItemCard item={item} title={title} viewMode={viewMode} />;
  }
}
