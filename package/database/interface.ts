export interface BaseObject {
    id: string;
}

export interface Auditable extends BaseObject {
    created_at: Date;
    updated_at: Date;
}
export interface Nameable extends BaseObject {
    name: string;
}
export interface Evaluable extends BaseObject {
    down: Person[];
    favorites: Person[];
    up: Person[];
}
export interface Relatable extends BaseObject {
    related_to: Relatable[];
    related_by: Relatable[];
}
export interface Author extends Nameable, Evaluable, Relatable {
    description?: string | null;
    books: Book[];
    user?: Person | null;
}
export interface Book extends Nameable, Auditable, Evaluable, Relatable {
    length: number;
    cover?: string | null;
    description?: string | null;
    grabbed_from: string;
    authors: Author[];
    chapters: Chapter[];
    publishers: Publisher[];
}
export interface Chapter extends Nameable, Evaluable, Relatable {
    order: number;
    book: Book;
    parent?: Chapter | null;
    children: Chapter[];
}
export interface Person extends Nameable, Auditable, Evaluable, Relatable {
    owned_down: Evaluable[];
    owned_favorites: Evaluable[];
    owned_up: Evaluable[];
    owned_tags: Tag[];
}
export interface Organization extends Person {
    members: Person[];
}
export interface Publisher extends Nameable, Evaluable, Relatable {
    domain: string;
    books: Book[];
}
export interface Tag extends Nameable, Auditable, Relatable {
    type: string;
    owners: Person[];
}
export interface Thread extends Nameable, Auditable, Evaluable, Relatable {
    content: string;
    author: Person;
    replies: Thread[];
}
export interface User extends Person {
    email: string;
    description?: string | null;
    friends: User[];
}
