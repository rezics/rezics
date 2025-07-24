import c from "./c";
import Auth from "./Auth";
import ReadList from "./ReadList";
import Book from "./Book";
import Review from "./Review";
import Tag from "./Tag";
import Post from "./Post";
import Comment from "./Comment";
import Homepage from "./HomePage";
import Chapter from "./Chapter";

export { Auth, Book, Review, Tag, Post, ReadList, Comment, Homepage, Chapter };

export default c.router({
    Auth,
    Book,
    // Review,
    Tag,
    // Post,
    // ReadList,
    // Comment,
    // Homepage,
    Chapter,
});
