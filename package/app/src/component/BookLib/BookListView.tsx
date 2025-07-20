import { Card, CardContent, Typography } from "@mui/material";

import { Book } from "contract";

export namespace BookListView {
    export type Show = {
        books: Book[];
    };

    export const Show: React.FC<Show> = ({ books }) => {
        return (
            <div className="mt-4 grid grid-cols-1">
                {books.map((book) => (
                    <Card key={book.id} className="mt-4 h-[200px] flex flex-row items-stretch gap-4 w-full">
                        {book.cover && (
                            <img
                                src={book.cover}
                                alt={book.title}
                                // style={{ width: "36%", objectFit: "cover" }}
                                className="!h-full object-cover"
                            />
                        )}
                        <CardContent className="flex-1 flex flex-col justify-between min-w-0">
                            <div>
                                <Typography variant="h6" className="mb-1">
                                    {book.title}
                                </Typography>
                                <Typography variant="subtitle2" color="text.secondary" className="mb-2">
                                    {book.author}
                                </Typography>
                                <Typography variant="body2" className="line-clamp-3">
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

    export type Container = {
        books: Book[];
    };

    export const Container: React.FC<Container> = ({ books }) => {
        return <Show books={books} />;
    };
}
