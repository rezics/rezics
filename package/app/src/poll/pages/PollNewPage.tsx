import { useTranslation } from "@rezics/i18n/react";
import type React from "react";
import { PollComposer } from "../components/PollComposer";

/**
 * Route-level entry for `/poll/new`: mounts the standalone poll composer.
 * `/poll/new` 的路由级入口：挂载独立的投票编辑器。
 *
 * Mobile <640px:
 * +---[Title]---+
 * |  Poll       |
 * |  Composer   |
 * |  Form       |
 * |  +-Options+ |
 * |  | Input  | |
 * |  |+--+--+ | |
 * |  |Btn|Btn| |
 * |  +------+ |
 * +----------+
 *
 * Tablet 640-1023px:
 * +-----[Title]-----+
 * |  PollComposer   |
 * |  Form           |
 * |  +-Form Input-+ |
 * |  | QuestionIn| |
 * |  | Options   | |
 * |  |+--+--+--+ | |
 * |  |Btn Btn Btn| |
 * |  +-----------+ |
 * +-----------------+
 *
 * Desktop 1024-1535px:
 * +-------[Title max-w-2xl]-------+
 * |  PollComposer               |
 * |  +-----Form (max-w-2xl)----+ |
 * |  | Question Input        | |
 * |  | +-Options Container-+ | |
 * |  | | +--+ +--+ +--+  | | |
 * |  | | |Opt|Opt|Opt| | | |
 * |  | | +--+ +--+ +--+  | | |
 * |  | +-----------------+ | |
 * |  | [Submit] [Cancel]    | |
 * |  +---------------------+ |
 * +---------------------------+
 *
 * Ultra-wide >=1536px:
 * +-------[Title max-w-2xl]-------+
 * |  PollComposer               |
 * |  +-----Form (max-w-2xl)----+ |
 * |  | Question Input        | |
 * |  | +-Options Container-+ | |
 * |  | | +--+ +--+ +--+  | | |
 * |  | | |Opt|Opt|Opt| | | |
 * |  | | +--+ +--+ +--+  | | |
 * |  | +-----------------+ | |
 * |  | [Submit] [Cancel]    | |
 * |  +---------------------+ |
 * +---------------------------+
 */
export const PollNewPage: React.FC = () => {
  const { t } = useTranslation(["community"]);
  return (
    <div className="mx-auto mt-16 w-full px-4 max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-text-primary">
        {t("community:poll_composer_title")}
      </h1>
      <PollComposer />
    </div>
  );
};
