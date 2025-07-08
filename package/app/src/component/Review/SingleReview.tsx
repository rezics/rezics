import { Box, Avatar, Typography, Button, Rating, Divider } from "@mui/material";
import { CollapsibleText } from "@component/Common/CollapsibleText";
import { ReactionBar } from "@component/Common/ReactionBar";
import { BookReview } from "@/api/bookReviews";

export namespace SingleReview {
    export type Show = {
        review: BookReview;
        onReply: (reviewId: string) => void;
        onFollow?: () => void;
    };

    export const Show: React.FC<Show> = ({ review, onReply, onFollow }) => {
        return (
            <div>
                <Box key={review.id}>
                    <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                        <Avatar src={review.user.avatar} sx={{ width: 40, height: 40, borderRadius: 1 }} />
                        <Box sx={{ ml: 2 }}>
                            <Typography variant="subtitle1" fontWeight="bold">
                                {review.user.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {review.createdAt}
                            </Typography>
                        </Box>
                        <Button variant="outlined" size="small" sx={{ ml: 2, py: 0.5 }} onClick={onFollow}>
                            Follow
                        </Button>
                        <Box sx={{ ml: "auto", textAlign: "right" }}>
                            <Rating defaultValue={review.rating} precision={0.5} />
                            <Typography variant="body2" color="text.secondary">
                                {990} reviews {1232} followers
                            </Typography>
                        </Box>
                    </Box>

                    <Box sx={{ mt: 2 }}>
                        <CollapsibleText.Show
                            content={review.content}
                            threshold={300}
                            isExpanded={false}
                            onToggle={() => {}}
                        />
                    </Box>

                    <Box className="w-full flex justify-end">
                        <Box sx={{ width: { xs: "100%", sm: "75%", md: "50%", lg: "50%", xl: "33.33%" } }}>
                            <ReactionBar.Show onReply={() => onReply(review.id)} />
                        </Box>
                    </Box>

                    <Divider sx={{ my: 2 }} />
                </Box>
            </div>
        );
    };

    export type Container = {
        review: BookReview;
        handleReply: (reviewId: string) => void;
    };

    export const Container: React.FC<Container> = ({ review, handleReply }) => {
        const handleFollow = () => {
            console.log("Follow clicked for user:", review.user.name);
        };

        return <Show review={review} onReply={handleReply} onFollow={handleFollow} />;
    };
}
