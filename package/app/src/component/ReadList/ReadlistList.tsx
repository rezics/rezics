import type {ReadlistResponse} from '@package/contract';
import {Grid} from '@mui/material';
import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import {SingleReadlist} from './SingleReadlistCard';

// * Complete list of book-related reading lists.
export function ReadlistList({booklists}: {booklists: ReadlistResponse[]}) {
  const navigate = useNavigate();

  const handleLike = (id: string) => {
    console.log('Liked book ID:', id);
  };

  const handleBookListClick = (id: string, event: React.MouseEvent) => {
    console.log('Clicked book ID:', id);
    console.log('Original event object:', event);
    event.preventDefault();
    event.stopPropagation();
    navigate({ to: `/readlist/${id}` });
  };

  return (
    <Grid container spacing={2}>
      {booklists.map((list: any) => (
        <Grid size={{xs: 12, lg: 6, xl: 4}} key={list.id}>
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
