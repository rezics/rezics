import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { createFileRoute } from "@tanstack/react-router";
import { RemarkListSection } from "@/remark";

export const Route = createFileRoute("/_mainLayout/remark/book/$bookId")({
  component: () => {
    const { bookId } = Route.useParams();
    return (
      <Box maxWidth="lg" mx="auto" px={2} py={3}>
        <Typography variant="h5" fontWeight={600} mb={3}>
          Remarks
        </Typography>
        <RemarkListSection targetUnitId={bookId} limit={50} />
      </Box>
    );
  },
});
