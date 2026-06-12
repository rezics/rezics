import type React from "react";
import { Route as excerptRoute } from "@/routes/_mainLayout/excerpt/$unitId";
import { ExcerptDetailSection } from "../sections/ExcerptDetailSection";

/**
 * 摘录页面。提取路由参数并渲染摘录详情部分。
 * Excerpt page. Extracts route params and renders the excerpt detail section.
 *
 * Mobile:            Tablet:             Desktop:            Ultra-wide:
 * ┌──────────────────┐ ┌────────────────────────┐ ┌────────────────────────┐ ┌──────────────────────────┐
 * │ Title            │ │ Title                  │ │ Title                  │ │ Title                    │
 * │                  │ │                        │ │                        │ │                          │
 * │ Excerpt Text     │ │ Excerpt Text           │ │ Excerpt Text           │ │ Excerpt Text             │
 * │ ...              │ │ ...                    │ │ ...                    │ │ ...                      │
 * │                  │ │                        │ │                        │ │                          │
 * │ ▬ Comments       │ │ ▬ Comments             │ │ ▬ Comments             │ │ ▬ Comments               │
 * │ [Reply...]       │ │ [Reply...]             │ │ [Reply...]             │ │ [Reply...]               │
 * │ Comment 1        │ │ Comment 1              │ │ Comment 1              │ │ Comment 1                │
 * │ Comment 2        │ │ Comment 2              │ │ Comment 2              │ │ Comment 2                │
 * └──────────────────┘ └────────────────────────┘ └────────────────────────┘ └──────────────────────────┘
 */
export const ExcerptPage: React.FC = () => {
  const { unitId } = excerptRoute.useParams();
  return (
    <div
      className="w-full max-w-4xl mt-[60px] mx-auto"
      data-testid="booklist-page"
    >
      <ExcerptDetailSection unitId={unitId ?? ""} />
    </div>
  );
};
