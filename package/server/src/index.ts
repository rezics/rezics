import express from 'express';
import cors from 'cors';
import { createExpressEndpoints, initServer } from '@ts-rest/express';
import { contract, User, ValidationError } from './contract.js';
import { DatabaseService } from './database.js';

const app = express();
const port = process.env.PORT || 4000;

// Initialize database
const db = new DatabaseService();
await db.init();

// Middleware
app.use(cors());
app.use(express.json());

// Mock authentication middleware
const getCurrentUser = (): User => ({
    id: "user1",
    name: "John Doe",
    avatar: "https://via.placeholder.com/150",
});

// Validation functions
const validateEmail = (email: string): ValidationError[] => {
    const errors: ValidationError[] = [];
    if (!email) {
        errors.push({ field: 'email', message: 'Email is required' });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push({ field: 'email', message: 'Invalid email format' });
    }
    return errors;
};

const validatePassword = (password: string): ValidationError[] => {
    const errors: ValidationError[] = [];
    if (!password) {
        errors.push({ field: 'password', message: 'Password is required' });
    } else if (password.length < 8) {
        errors.push({ field: 'password', message: 'Password must be at least 8 characters long' });
    }
    return errors;
};

// Initialize ts-rest server
const s = initServer();

// Create router with API endpoints
const router = s.router(contract, {
    auth: {
        login: async ({ body }) => {
            const { email, password } = body;
            
            // Validate input
            const emailErrors = validateEmail(email);
            const passwordErrors = validatePassword(password);
            const errors = [...emailErrors, ...passwordErrors];
            
            if (errors.length > 0) {
                return { status: 400, body: errors };
            }
            
            // Mock authentication logic
            const user = await db.getUserByEmail(email);
            if (!user) {
                return { 
                    status: 400, 
                    body: [{ field: 'email', message: 'User not found' }] 
                };
            }
            
            return {
                status: 200,
                body: {
                    token: 'mock-jwt-token',
                    user,
                },
            };
        },
        
        register: async ({ body }) => {
            const { email, password } = body;
            
            // Validate input
            const emailErrors = validateEmail(email);
            const passwordErrors = validatePassword(password);
            const errors = [...emailErrors, ...passwordErrors];
            
            if (errors.length > 0) {
                return { status: 400, body: errors };
            }
            
            // Check if user already exists
            const existingUser = await db.getUserByEmail(email);
            if (existingUser) {
                return { 
                    status: 400, 
                    body: [{ field: 'email', message: 'User already exists' }] 
                };
            }
            
            // Create new user
            const user = await db.createUser(email, password, email.split('@')[0]);
            
            return {
                status: 200,
                body: {
                    token: 'mock-jwt-token',
                    user,
                },
            };
        },
        
        me: async () => {
            const user = getCurrentUser();
            return {
                status: 200,
                body: user,
            };
        },
    },
    
    validation: {
        email: async ({ body }) => {
            const errors = validateEmail(body.email);
            return { status: 200, body: errors };
        },
        
        password: async ({ body }) => {
            const errors = validatePassword(body.password);
            return { status: 200, body: errors };
        },
    },
    
    books: {
        reviews: async ({ params }) => {
            const reviews = await db.getBookReviews(params.bookId);
            return { status: 200, body: reviews };
        },
        
        addReview: async ({ params, body }) => {
            const user = getCurrentUser();
            const review = await db.addReview(params.bookId, body.content, body.rating, user);
            return { status: 200, body: review };
        },
    },
    
    bookLists: {
        getAll: async () => {
            const bookLists = await db.getAllBookLists();
            return { status: 200, body: bookLists };
        },
        
        getOne: async ({ params }) => {
            const bookList = await db.getBookList(params.id);
            if (!bookList) {
                return { status: 404, body: { message: 'BookList not found' } };
            }
            return { status: 200, body: bookList };
        },
        
        comments: async ({ params }) => {
            const comments = await db.getComments(params.bookListId);
            return { status: 200, body: comments };
        },
        
        addComment: async ({ params, body }) => {
            const user = getCurrentUser();
            const comment = await db.addComment(params.bookListId, body.content, user);
            return { status: 200, body: comment };
        },
    },
    
    comments: {
        addReply: async ({ params, body }) => {
            const user = getCurrentUser();
            const reply = await db.addReply(params.commentId, body.content, user);
            return { status: 200, body: reply };
        },
    },
});

// Apply routes to Express app
createExpressEndpoints(contract, router, app);

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log('REST API endpoints:');
    console.log('- POST /auth/login');
    console.log('- POST /auth/register');
    console.log('- GET /auth/me');
    console.log('- POST /validation/email');
    console.log('- POST /validation/password');
    console.log('- GET /books/:bookId/reviews');
    console.log('- POST /books/:bookId/reviews');
    console.log('- GET /booklists');
    console.log('- GET /booklists/:id');
    console.log('- GET /booklists/:bookListId/comments');
    console.log('- POST /booklists/:bookListId/comments');
    console.log('- POST /comments/:commentId/replies');
});
