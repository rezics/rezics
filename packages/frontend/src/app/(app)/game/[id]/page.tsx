import { SectionBoundary } from "@/components/SectionBoundary";
import { GameDetailContent } from "./content";

/**
 * Mobile-Ultra-wide: max-w-3xl mx-auto。
 *
 * +-----------------------------+
 * | [cover/banner]              |
 * | Game Title                  |
 * | Developer · Publisher       |
 * | [Platforms] [Rating]        |
 * |-----------------------------|
 * | [Info|Reviews|Discussion]   |
 * |-----------------------------|
 * | {tab content}               |
 * +-----------------------------+
 *
 * 游戏详情页：封面 + 元数据 + tabs。
 * 复用 Unit 统一模型，type=GAME。
 */
export default function GameDetailPage({ params }: { readonly params: Promise<{ id: string }> }) {
  return (
    <SectionBoundary>
      <GameDetailContent paramsPromise={params} />
    </SectionBoundary>
  );
}
