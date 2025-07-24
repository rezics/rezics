import c from "./c";
import Auth from "./Auth";
import ReadList from "./ReadList";
import Book from "./Book";
import Review from "./Review";
import Tag from "./Tag";
import Post from "./Post";
import Comment from "./Comment";
import Homepage from "./HomePage";

export { Auth, Book, Review, Tag, Post, ReadList, Comment, Homepage };

export default c.router({
    auth: Auth,
    book: Book,
    review: Review,
    tag: Tag,
    post: Post,
    readlist: ReadList,
    comment: Comment,
    home: Homepage,
});
