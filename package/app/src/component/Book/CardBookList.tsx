import { Card, CardContent, CardMedia, Typography } from "@mui/material";

import { Book } from "contract/schema";

interface CardBookListProps {
    books: Book[];
}

export const CardBookList = ({ books }: CardBookListProps) => {
    return (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {books.map((book) => (
                <Card
                    key={book.id}
                    className="h-full flex flex-row items-stretch gap-4 w-full"
                >
                    {book.cover && (
                        <CardMedia
                            component="img"
                            image={book.cover}
                            alt={book.title}
                            style={{ width: "36%", objectFit: "cover" }}
                        />
                    )}
                    <CardContent className="flex-1 flex flex-col justify-between min-w-0">
                        <div>
                            <Typography variant="h6" className="mb-1">
                                {book.title}
                            </Typography>
                            <Typography
                                variant="subtitle2"
                                color="text.secondary"
                                className="mb-2"
                            >
                                {book.author.name}
                            </Typography>
                            <Typography
                                variant="body2"
                                className="line-clamp-3"
                            >
                                {book.description}
                            </Typography>
                        </div>
                        {/* 如果需要底部操作按钮之类的，可以放在这里 */}
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};
