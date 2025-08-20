import { BookList } from "@/api/readlist";
import { Favorite } from "@mui/icons-material";
import { Avatar, Box, Card, CardContent, Grid, IconButton, Stack, Typography } from "@mui/material";

interface SingleReadlistProps {
    list: BookList;
    handleBookListClick: (id: string, e: React.MouseEvent) => void;
    handleLike: (id: string) => void;
}

export function SingleReadlist(
    { list, handleBookListClick, handleLike }: SingleReadlistProps,
) {
    return (
        <Card
            sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                cursor: "pointer",
                transition: "box-shadow 0.2s",
                "&:hover": {
                    boxShadow: 4,
                },
            }}
            onClick={(e) => handleBookListClick(list.id, e)}
        >
            <CardContent
                sx={{ flex: 1, display: "flex", flexDirection: "column" }}
            >
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                    {list.title}
                </Typography>

                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                        mb: 2,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                    }}
                >
                    {list.description}
                </Typography>

                <Grid container spacing={1} sx={{ mb: 2 }}>
                    {list.books.slice(0, 4).map((cover, index) => (
                        <Grid size={{ xs: 3 }} key={index}>
                            <Box
                                component="img"
                                src={cover}
                                sx={{
                                    width: "100%",
                                    aspectRatio: "3/4",
                                    objectFit: "cover",
                                    borderRadius: 1,
                                }}
                            />
                        </Grid>
                    ))}
                </Grid>

                <Box
                    sx={{
                        mt: "auto",
                        pt: 2,
                        borderTop: 1,
                        borderColor: "divider",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}
                >
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Avatar
                            src={list.creator.avatar}
                            sx={{ width: 24, height: 24 }}
                        />
                        <Typography variant="body2" color="text.secondary">
                            {list.creator.name}
                        </Typography>
                    </Stack>

                    <Stack direction="row" spacing={1} alignItems="center">
                        <IconButton
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleLike(list.id);
                            }}
                        >
                            <Favorite fontSize="small" />
                        </IconButton>
                        <Typography variant="body2" color="text.secondary">
                            {list.likes}
                        </Typography>
                    </Stack>
                </Box>
            </CardContent>
        </Card>
    );
}
