import { buttonVariants } from "@rezics/ui/shadcn";
import { ArrowLeft } from "lucide-react";
import { Page } from "@/admin/core/layouts/Page";
import { Link } from "@/admin/shared/ui/link";
import { MeiliObservabilitySection } from "../components/MeiliObservabilitySection";

export function MeiliObservabilityPage() {
  return (
    <Page
      title="Meili 狀態觀測"
      description="唯讀檢查 expected schema、live index 統計、settings drift、內容計數與最近任務。"
      actions={
        <Link
          to="/meili"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          回到操作
        </Link>
      }
    >
      <MeiliObservabilitySection />
    </Page>
  );
}

export default MeiliObservabilityPage;
