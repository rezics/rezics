import { SectionBoundary } from "@/components/SectionBoundary";

/**
 * 用户反应历史：点赞/收藏等反应记录。
 */
export default function MyReactionsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">My Reactions</h1>
      <SectionBoundary>
        <div className="text-muted-foreground py-12 text-center text-sm">
          Your reaction history will appear here.
        </div>
      </SectionBoundary>
    </div>
  );
}
