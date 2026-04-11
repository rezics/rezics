import { Grid } from "@mui/material";
import type { ShelfDTO } from "@rezics/contract";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { SingleReadlist } from "./SingleReadlistCard";

/**
 * ReadlistList - now uses ShelfDTO instead of ReadlistResponse.
 */
export function ReadlistList({ booklists }: { booklists: ShelfDTO[] }) {
  const navigate = useNavigate();

  const handleLike = (id: string) => {
    console.log("Liked shelf ID:", id);
  };

  const handleBookListClick = (id: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    navigate({ to: `/readlist/${id}` });
  };

  return (
    <Grid container spacing={2}>
      {booklists.map((list) => (
        <Grid size={{ xs: 12, lg: 6, xl: 4 }} key={list.unitId}>
          <SingleReadlist
            data={list}
            handleBookListClick={handleBookListClick}
            handleLike={handleLike}
          />
        </Grid>
      ))}
    </Grid>
  );
}
