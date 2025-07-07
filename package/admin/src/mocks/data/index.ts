export const mockUsers = [
    {
        id: "user-1",
        name: "John Doe",
        avatar: "https://via.placeholder.com/150",
    },
    {
        id: "user-2",
        name: "Jane Smith",
        avatar: "https://via.placeholder.com/150",
    },
];

export const mockReviews = [
    {
        id: "review-1",
        bookId: "book-1",
        content: "Great book!",
        rating: 4.5,
        createdAt: "2024-01-01T00:00:00Z",
        user: mockUsers[0],
    },
    {
        id: "review-2",
        bookId: "book-1",
        content: "Not bad",
        rating: 3.5,
        createdAt: "2024-01-02T00:00:00Z",
        user: mockUsers[1],
    },
];

export const mockBookLists = [
    {
        id: "list-1",
        title: "My Favorite Books",
        description: "A collection of my favorite books",
        books: ["book-1", "book-2", "book-3"],
        creator: mockUsers[0],
        likes: 10,
        commentsNumber: 2,
    },
    {
        id: "list-2",
        title: "Summer Reading List",
        description: "Books to read this summer",
        books: ["book-4", "book-5"],
        creator: mockUsers[1],
        likes: 5,
        commentsNumber: 1,
    },
];

export const mockComments = [
    {
        id: "comment-1",
        bookListId: "list-1",
        content: "Great list!",
        createdAt: "2024-01-01T00:00:00Z",
        user: mockUsers[1],
        likes: 2,
        replies: [
            {
                id: "reply-1",
                content: "Thanks!",
                createdAt: "2024-01-01T01:00:00Z",
                user: mockUsers[0],
                likes: 1,
                replies: [],
            },
        ],
    },
    {
        id: "comment-2",
        bookListId: "list-1",
        content: "I love these books too!",
        createdAt: "2024-01-02T00:00:00Z",
        user: mockUsers[1],
        likes: 1,
        replies: [],
    },
];
