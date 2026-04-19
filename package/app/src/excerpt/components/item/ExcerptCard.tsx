import FormatQuoteRoundedIcon from "@mui/icons-material/FormatQuoteRounded";
import {
  Avatar,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Typography,
} from "@mui/material";
import type { ExcerptSource, UnitDTO } from "@rezics/contract";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { cn } from "@/shared/utils/css-util";

export interface ExcerptCardProps {
  excerpt: UnitDTO;
  className?: string;
}

export const ExcerptCard: React.FC<ExcerptCardProps> = ({
  excerpt,
  className,
}) => {
  const navigate = useNavigate();

  const handleOpenExcerpt = () => {
    if (!excerpt.id) return;
    navigate({ to: "/excerpt/$unitId", params: { unitId: excerpt.id } });
  };

  const source = (excerpt.extra as Record<string, unknown> | null)?.source as
    | ExcerptSource
    | string
    | undefined;
  const description = excerpt.translations?.[0]?.description ?? "暂无摘录内容";

  return (
    <Card elevation={0} className={cn("w-full transition-all mb-1", className)}>
      <CardActionArea onClick={handleOpenExcerpt} disabled={!excerpt.id}>
        <CardContent>
          <Box className="flex items-start gap-2">
            <FormatQuoteRoundedIcon
              sx={{ color: "text.secondary", mt: 0.4 }}
              fontSize="small"
            />

            <Box className="min-w-0 flex-1">
              {excerpt.user && (
                <Box className="flex items-center gap-2 mb-1">
                  <Avatar
                    src={excerpt.user.avatar ?? ""}
                    sx={{ width: 20, height: 20 }}
                    variant="rounded"
                  />
                  <Typography variant="caption" fontWeight={600}>
                    {excerpt.user.name ?? ""}
                  </Typography>
                </Box>
              )}
              <Typography
                variant="body2"
                color="text.primary"
                className="line-clamp-3 leading-7"
              >
                {description}
              </Typography>

              <Box className="mt-3 flex items-center justify-between gap-2">
                <Typography variant="caption" noWrap>
                  0 喜欢
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  —— <ExcerptCardSource source={source} />
                </Typography>
              </Box>
            </Box>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

function ExcerptCardSource({ source }: { source?: ExcerptSource | string }) {
  if (!source) return <>未知出处</>;
  if (typeof source === "string") return <>{source}</>;
  return <>{source.title}</>;
}

export default ExcerptCard;
