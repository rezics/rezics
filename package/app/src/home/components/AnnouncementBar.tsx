import { Box, Typography, useTheme } from "@mui/material";
import { MUILink } from "@rezics/ui/primitive/link/MUILink.tsx";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { Megaphone as CampaignRoundedIcon, Pin as PushPinRoundedIcon } from "lucide-react";

export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
  pin?: boolean;
  link?: string;
}

interface AnnouncementBarProps {
  announcements: Announcement[];
  max?: number;
  interval?: number; // ms
}

export function AnnouncementBar({
  announcements,
  max = 5,
  interval = 4000,
}: AnnouncementBarProps) {
  const theme = useTheme();
  const items = announcements.slice(0, max);

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
    <Box
      component="div"
      sx={{
        px: 2,
        py: 1,
        display: "flex",
        alignItems: "center",
        borderRadius: 2,
      }}
    >
      <CampaignRoundedIcon
        color={theme.palette.primary.main} size={18} style={{ marginRight: "12px" }}
      />

      <div className="relative flex-1 overflow-hidden h-[28px] flex items-center">
        {items.map((item, i) => {
          const isActive = i === index;
          const Wrapper = item.link ? MUILink : "div";

          return (
            <Wrapper
              key={item.id}
              to={item.link as any}
              className={clsx(
                "absolute left-0 top-0 w-full h-full flex items-center gap-2 transition-all duration-500",
                item.link && "cursor-pointer",
              )}
              style={{
                transform: `translateY(${(i - index) * 100}%)`,
                opacity: isActive ? 1 : 0,
              }}
            >
              {item.pin && (
                <PushPinRoundedIcon
                  size={14} color={theme.palette.warning.main}
                />
              )}

              <Typography
                variant="body2"
                sx={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {item.content}
              </Typography>
            </Wrapper>
          );
        })}
      </div>
    </Box>
  );
}
