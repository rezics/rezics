import { Surreal } from "surrealdb";
import { surrealdbWasmEngines } from "@surrealdb/wasm";
import { User, Review, BookList, Comment } from "./contract.js";

export class DatabaseService {
    private db: Surreal;
    
    constructor() {
        this.db = new Surreal({
            engines: surrealdbWasmEngines(),
        });
    }
    
    async init() {
        await Promise.all([
            this.db.connect("mem://", { namespace: "library", database: "books" }),
            this.db.ready
        ]);
        
        // Initialize with some mock data
        await this.seedData();
    }
    
    private async seedData() {
        // Create mock users
        const users: User[] = [
            { id: "user1", name: "John Doe", avatar: "https://via.placeholder.com/150" },
            { id: "user2", name: "Jane Smith", avatar: "https://via.placeholder.com/150" },
        ];
        
        for (const user of users) {
            await this.db.create("users", user);
        }
        
        // Create mock booklists
        const bookLists: BookList[] = [
            {
                id: "list1",
                title: "Best Fantasy Books",
                description: "My favorite fantasy novels",
                books: ["book1", "book2", "book3"],
                creator: users[0],
                likes: 42,
                commentsNumber: 5,
            },
            {
                id: "list2",
                title: "Sci-Fi Classics",
                description: "Classic science fiction literature",
                books: ["book4", "book5"],
                creator: users[1],
                likes: 23,
                commentsNumber: 3,
            },
        ];
        
        for (const bookList of bookLists) {
            await this.db.create("booklists", bookList);
        }
        
        // Create mock reviews
        const reviews: Review[] = [
            {
                id: "review1",
                content: "Amazing book! Highly recommend it.",
                rating: 4.5,
                createdAt: new Date().toISOString(),
                user: users[0],
            },
            {
                id: "review2",
                content: "Good read, but could be better.",
                rating: 3.0,
                createdAt: new Date().toISOString(),
                user: users[1],
            },
        ];
        
        for (const review of reviews) {
            await this.db.create("reviews", review);
        }
        
        // Create mock comments
        const comments: Comment[] = [
            {
                id: "comment1",
                content: "Great list! Thanks for sharing.",
                createdAt: new Date().toISOString(),
                user: users[1],
                likes: 5,
            },
            {
                id: "comment2",
                content: "I would add more books to this list.",
                createdAt: new Date().toISOString(),
                user: users[0],
                likes: 2,
            },
        ];
        
        for (const comment of comments) {
            await this.db.create("comments", comment);
        }
    }
    
    async getBookReviews(bookId: string): Promise<Review[]> {
        const result = await this.db.query<Review[][]>("SELECT * FROM reviews WHERE bookId = $bookId", {
            bookId
        });
        return result[0] || [];
    }
    
    async addReview(bookId: string, content: string, rating: number, user: User): Promise<Review> {
        const review: Review = {
            id: `review_${Date.now()}`,
            content,
            rating,
            createdAt: new Date().toISOString(),
            user,
        };
        
        await this.db.create("reviews", { ...review, bookId });
        return review;
    }
    
    async getAllBookLists(): Promise<BookList[]> {
        const result = await this.db.query<BookList[][]>("SELECT * FROM booklists");
        return result[0] || [];
    }
    
    async getBookList(id: string): Promise<BookList | null> {
        const result = await this.db.query<BookList[][]>("SELECT * FROM booklists WHERE id = $id", {
            id
        });
        return result[0]?.[0] || null;
    }
    
    async getComments(bookListId: string): Promise<Comment[]> {
        const result = await this.db.query<Comment[][]>("SELECT * FROM comments WHERE bookListId = $bookListId", {
            bookListId
        });
        return result[0] || [];
    }
    
    async addComment(bookListId: string, content: string, user: User): Promise<Comment> {
        const comment: Comment = {
            id: `comment_${Date.now()}`,
            content,
            createdAt: new Date().toISOString(),
            user,
            likes: 0,
        };
        
        await this.db.create("comments", { ...comment, bookListId });
        return comment;
    }
    
    async addReply(commentId: string, content: string, user: User): Promise<Comment> {
        const reply: Comment = {
            id: `reply_${Date.now()}`,
            content,
            createdAt: new Date().toISOString(),
            user,
            likes: 0,
        };
        
        await this.db.create("comments", { ...reply, parentId: commentId });
        return reply;
    }
    
    async getUser(id: string): Promise<User | null> {
        const result = await this.db.query<User[][]>("SELECT * FROM users WHERE id = $id", {
            id
        });
        return result[0]?.[0] || null;
    }
    
    async getUserByEmail(email: string): Promise<User | null> {
        const result = await this.db.query<User[][]>("SELECT * FROM users WHERE email = $email", {
            email
        });
        return result[0]?.[0] || null;
    }
    
    async createUser(email: string, password: string, name: string): Promise<User> {
        const user: User = {
            id: `user_${Date.now()}`,
            name,
            avatar: "https://via.placeholder.com/150",
        };
        
        await this.db.create("users", { ...user, email, password });
        return user;
    }
}