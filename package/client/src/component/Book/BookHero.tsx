import { Box, Chip, Container as MuiContainer, Grid, Rating, Stack, Typography } from "@mui/material";

import { BookReadPartial } from "@/api/Book.ts";
export namespace BookHero {
    export const Show: React.FC<{ data: BookReadPartial }> = ({ data }) => {
        return (
            <div>
                <Box
                    className="bg-cover bg-center relative"
                    style={{ backgroundImage: `url(${data?.cover})` }}
                >
                    {/* Light Pic test is fine, the black blur is thick so the text is always able to read */}
                    {/* <Box className="bg-cover bg-center relative" style={{ backgroundImage: `url(https://static-cse.canva.cn/blob/239388/e1604019539295.jpg)` }}> */}
                    <Box className="bg-black/66 backdrop-blur-md shadow-lg">
                        <MuiContainer maxWidth="lg" className="py-6">
                            <Grid container spacing={3}>
                                {/* Cover Image */}
                                <Grid
                                    size={{ xs: 12, md: 3, lg: 2 }}
                                    className="max-h-[300px] w-full"
                                >
                                    <img
                                        src={data?.cover ?? ""}
                                        alt={data?.name}
                                        className="h-full rounded-lg shadow-lg mr-auto ml-auto"
                                    />
                                </Grid>

                                {/* Book Info */}
                                <Grid size={{ xs: 12, md: 9 }}>
                                    <Stack spacing={2}>
                                        {/* Title and Rating */}
                                        <Box className="flex justify-between items-center">
                                            <Typography
                                                variant="h4"
                                                className="font-bold text-white"
                                            >
                                                {data?.name}
                                            </Typography>
                                            <Box className="flex items-center gap-2">
                                                <Rating
                                                    value={(data?.rating || 0)
                                                        / 2}
                                                    precision={0.5}
                                                    readOnly
                                                />
                                                <Typography
                                                    variant="h6"
                                                    className="text-amber-500"
                                                >
                                                    {data?.rating} / 10
                                                </Typography>
                                            </Box>
                                        </Box>

                                        {/* Author & Publisher Info */}
                                        <Stack
                                            spacing={1}
                                            className="text-white"
                                        >
                                            <Typography>
                                                作者：
                                                <Box
                                                    component="span"
                                                    className="font-medium"
                                                >
                                                    {data?.authors?.[0]?.name}
                                                </Box>
                                            </Typography>
                                            <Typography>
                                                出版社：{data?.publishers?.[0]
                                                    ?.name}
                                            </Typography>
                                            <Typography>
                                                出版日期：{data?.publishDate ?? ""}
                                            </Typography>
                                            <Typography>
                                                ISBN：{data?.isbn ?? ""}
                                            </Typography>
                                        </Stack>

                                        {/* Tags */}
                                        <Stack direction="row" spacing={1}>
                                            {data?.tags?.map((tag: string) => (
                                                <Chip
                                                    key={tag}
                                                    label={tag}
                                                    size="small"
                                                    onClick={() => {
                                                        console.log(
                                                            "tag clicked",
                                                            tag,
                                                        );
                                                    }}
                                                    className="*:bg-white/10 *:text-white *:hover:bg-white/20 *:p-1"
                                                />
                                            ))}
                                        </Stack>
                                    </Stack>
                                </Grid>
                            </Grid>
                        </MuiContainer>
                    </Box>
                </Box>
            </div>
        );
    };

    export type Container = {
        data: any;
    };

    export const Container: React.FC<Container> = ({ data }) => {
        return <Show data={data} />;
    };
}
