import { cn } from "@/shared/utils/css-util";
import {
  Megaphone as CampaignRoundedIcon,
  Pin as PushPinRoundedIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { TextLink } from "@/shared/ui/link";

export interface NoticeBarItem {
  id: string;
  title: string;
  content: string;
  date: string;
  pin?: boolean;
  link?: string;
}

interface NoticeBarProps {
  notices: NoticeBarItem[];
  max?: number;
  interval?: number; // ms — 毫秒
}

export function NoticeBar({
  notices,
  max = 5,
  interval = 4000,
}: NoticeBarProps) {
  const items = notices.slice(0, max);

  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (items.length <= 1) return;

    timerRef.current = setInterval(() => {
      setIndex((prev) => (prev + 1) % items.length);
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [items.length, interval]);

  if (!items.length) return null;

  return (
    <div className="px-4 py-2 flex items-center rounded-lg">
      <CampaignRoundedIcon
        className="text-text-brand"
        size={18}
        style={{ marginRight: "12px" }}
      />

      <div className="relative flex-1 overflow-hidden h-[28px] flex items-center">
        {items.map((item, i) => {
          const isActive = i === index;
          const Wrapper = item.link ? TextLink : "div";

          return (
            <Wrapper
              key={item.id}
              to={item.link as any}
              className={cn(
                "absolute left-0 top-0 w-full h-full flex items-center gap-2 transition-all duration-500",
                item.link && "cursor-pointer",
              )}
              style={{
                transform: `translateY(${(i - index) * 100}%)`,
                opacity: isActive ? 1 : 0,
              }}
            >
              {item.pin && (
                <PushPinRoundedIcon size={14} className="text-warning-text" />
              )}

              <p className="text-sm whitespace-nowrap overflow-hidden text-ellipsis m-0">
                {item.content}
              </p>
            </Wrapper>
          );
        })}
      </div>
    </div>
  );
}
