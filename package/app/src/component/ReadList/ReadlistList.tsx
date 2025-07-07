import React from "react";
import { Box, Grid, Typography, Avatar, IconButton, Card, CardContent, Stack } from "@mui/material";
import { proxy, useSnapshot } from "valtio";
import { Favorite } from "@mui/icons-material";
import { BookList } from "@/api/readlist";
import { useLocation } from "wouter";
import { SingleReadlist } from "./SingleReadlist";

const state = proxy({
    booklists: [] as BookList[],
    loading: false,
    error: null as string | null,
});

// * Complete list of book-related reading lists.
export function ReadlistList({ booklists }: { booklists: BookList[] }) {
    const [, navigate] = useLocation();
    
    const handleLike = (id: string) => {
        console.log("Liked book ID:", id);
    };

    const handleBookListClick = (id: string, event: React.MouseEvent) => {
        console.log("Clicked book ID:", id);
        console.log("Original event object:", event);
        event.preventDefault();
        event.stopPropagation();
        navigate(`/booklist/${id}`);
    };

    return (
        <Grid container spacing={2}>
            {booklists.map((list: any) => (
                <Grid size={{ xs: 12, lg: 6, xl: 4 }} key={list.id}>
                    <SingleReadlist list={list} handleBookListClick={handleBookListClick} handleLike={handleLike} />
                </Grid>
            ))}
        </Grid>
    );
};
