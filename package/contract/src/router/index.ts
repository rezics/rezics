import c from "./c";
import { UserRouter } from "./User";
import { AuthorRouter } from "./Author";
import { BookRouter } from "./Book";
import { ChapterRouter } from "./Chapter";
import { ReviewRouter } from "./Review";
import { TagRouter } from "./Tag";
import { CommentRouter } from "./Comment";
import { PostRouter } from "./Post";
import { ReadListRouter } from "./ReadList";
import { ReactionRouter } from "./Reaction";
import { AwardRouter } from "./Award";
import { HomePageRouter } from "./HomePage";
import { PermissionRouter } from "./Permission";
import { PublishInfoRouter } from "./PublishInfo";

export const Router = {
    Auth,
    Book,
    Review,
    Tag,
    Post,
    ReadList,
    Comment,
    Homepage,
    Chapter,
};

export default c.router({
    users: UserRouter,
    authors: AuthorRouter,
    books: BookRouter,
    chapters: ChapterRouter,
    reviews: ReviewRouter,
    tags: TagRouter,
    comments: CommentRouter,
    posts: PostRouter,
    readlists: ReadListRouter,
    reactions: ReactionRouter,
    awards: AwardRouter,
    homepage: HomePageRouter,
    permissions: PermissionRouter,
    publishinfo: PublishInfoRouter,
});
