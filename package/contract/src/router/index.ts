import c from "./c";
import User from "./User";
import Author from "./Author";
import Book from "./Book";
import Chapter from "./Chapter";
import Review from "./Review";
import Tag from "./Tag";
import Comment from "./Comment";
import Post from "./Post";
import ReadList from "./ReadList";
import Reaction from "./Reaction";
import Award from "./Award";
import HomePage from "./HomePage";
import Permission from "./Permission";
import PublishInfo from "./PublishInfo";

export const Router = {
    Author,
    Book,
    Review,
    Tag,
    Post,
    ReadList,
    Comment,
    Chapter,
    Reaction,
    Award,
    HomePage,
    Permission,
    PublishInfo,
};

export default c.router({
    users: User,
    authors: Author,
    books: Book,
    chapters: Chapter,
    reviews: Review,
    tags: Tag,
    comments: Comment,
    posts: Post,
    readlists: ReadList,
    reactions: Reaction,
    awards: Award,
    homepage: HomePage,
    permissions: Permission,
    publishInfo: PublishInfo,
});
