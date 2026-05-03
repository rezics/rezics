import { createFileRoute } from "@tanstack/react-router";
import { RemarkListSection } from "@/remark";

export const Route = createFileRoute("/_mainLayout/remark/book/$bookId")({
  component: () => {
    const { bookId } = Route.useParams();
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-6">
        <h2 className="text-xl font-semibold mb-6">Remarks</h2>
        <RemarkListSection targetUnitId={bookId} limit={50} />
      </div>
    );
  },
});
