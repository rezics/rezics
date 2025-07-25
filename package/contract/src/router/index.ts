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

export { 
    UserRouter, 
    AuthorRouter, 
    BookRouter, 
    ChapterRouter, 
    ReviewRouter, 
    TagRouter, 
    CommentRouter, 
    PostRouter, 
    ReadListRouter, 
    ReactionRouter, 
    AwardRouter, 
    HomePageRouter,
    PermissionRouter,
    PublishInfoRouter
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
