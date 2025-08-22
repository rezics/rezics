import { BookList } from "@/api/readlist";
import { Grid } from "@mui/material";
import React from "react";
import { useLocation } from "wouter";
import { SingleReadlist } from "./SingleReadlist";

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
		navigate(`/readlist/${id}`);
	};

	return (
		<Grid container spacing={2}>
			{booklists.map((list: any) => (
				<Grid size={{ xs: 12, lg: 6, xl: 4 }} key={list.id}>
					<SingleReadlist
						list={list}
						handleBookListClick={handleBookListClick}
						handleLike={handleLike}
					/>
				</Grid>
			))}
		</Grid>
	);
}
