import { Box, Chip, Rating, Container, Grid, Stack, Typography } from "@mui/material";

import { Book } from "@/page/Book/BookPage";

export function BookHero({ data }: { data: Book }) {
    return (
        <div>
            <Box className="bg-cover bg-center relative" style={{ backgroundImage: `url(${data?.cover})` }}>
                {/* Light Pic test is fine, the black blur is thick so the text is always able to read */}
                {/* <Box className="bg-cover bg-center relative" style={{ backgroundImage: `url(https://static-cse.canva.cn/blob/239388/e1604019539295.jpg)` }}> */}
                <Box className="bg-black/66 backdrop-blur-md shadow-lg">
                    <Container maxWidth="lg" className="py-6">
                        <Grid container spacing={3}>
                            {/* Cover Image */}
                            <Grid size={{ xs: 12, md: 3, lg: 2 }} className="max-h-[300px] w-full">
                                <img
                                    src={data?.cover}
                                    alt={data?.title}
                                    className="h-full rounded-lg shadow-lg mr-auto ml-auto"
                                />
                            </Grid>

                            {/* Book Info */}
                            <Grid size={{ xs: 12, md: 9 }}>
                                <Stack spacing={2}>
                                    {/* Title and Rating */}
                                    <Box className="flex justify-between items-center">
                                        <Typography variant="h4" className="font-bold text-white">
                                            {data?.title}
                                        </Typography>
                                        <Box className="flex items-center gap-2">
                                            <Rating value={(data?.rating || 0) / 2} precision={0.5} readOnly />
                                            <Typography variant="h6" className="text-amber-500">
                                                {data?.rating} / 10
                                            </Typography>
                                        </Box>
                                    </Box>

                                    {/* Author & Publisher Info */}
                                    <Stack spacing={1} className="text-white">
                                        <Typography>
                                            作者：
                                            <Box component="span" className="font-medium">
                                                {data?.author}
                                            </Box>
                                        </Typography>
                                        <Typography>出版社：{data?.publisher}</Typography>
                                        <Typography>出版日期：{data?.publishDate}</Typography>
                                        <Typography>ISBN：{data?.isbn}</Typography>
                                    </Stack>

                                    {/* Tags */}
                                    <Stack direction="row" spacing={1}>
                                        {data?.tags.map((tag: string) => (
                                            <Chip
                                                key={tag}
                                                label={tag}
                                                size="small"
                                                className="*:bg-white/10 *:text-white *:hover:bg-white/20 *:p-1"
                                            />
                                        ))}
                                    </Stack>
                                </Stack>
                            </Grid>
                        </Grid>
                    </Container>
                </Box>
            </Box>
        </div>
    )
}