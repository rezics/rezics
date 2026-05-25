import { search_category_remarks } from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { createFileRoute } from "@tanstack/react-router";
import { RemarkListSection } from "@/remark";

const i18nMessages = {
  search_category_remarks,
};

export const Route = createFileRoute("/_mainLayout/remark/book/$bookId")({
  component: () => {
    const m = useMessage(i18nMessages);
    const { bookId } = Route.useParams();
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-6">
        <h2 className="text-xl font-semibold mb-6">
          {m.search_category_remarks()}
        </h2>
        <RemarkListSection targetUnitId={bookId} limit={50} />
      </div>
    );
  },
});
