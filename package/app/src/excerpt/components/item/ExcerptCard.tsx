import FormatQuoteRoundedIcon from "@mui/icons-material/FormatQuoteRounded";
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Typography,
  useTheme,
} from "@mui/material";
import type { ExcerptSource, UnitDTO } from "@rezics/contract";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { cn } from "@/shared/utils/css-util";

export interface ExcerptCardProps {
  excerpt: UnitDTO;
  className?: string;
}

const ExcerptCard: React.FC<ExcerptCardProps> = ({ excerpt, className }) => {
  const theme = useTheme();
  const navigate = useNavigate();

  const handleOpenExcerpt = () => {
    if (!excerpt.id) return;
    navigate({ to: "/excerpt/$unitId", params: { unitId: excerpt.id } });
  };

  return (
    <Card elevation={0} className={cn("w-full transition-all mb-1", className)}>
      <CardActionArea onClick={handleOpenExcerpt} disabled={!excerpt.id}>
        <CardContent>
          <Box className="flex items-start gap-2">
            <FormatQuoteRoundedIcon
              sx={{ color: theme.palette.text.secondary, mt: 0.4 }}
              fontSize="small"
            />

            <Box className="min-w-0 flex-1">
              <Typography
                variant="body2"
                color="text.primary"
                className="line-clamp-3 leading-7"
              >
                {excerpt.translations?.[0]?.description || "暂无摘录内容"}
              </Typography>

              <Box className="mt-3 flex items-center justify-between gap-2">
                <Typography variant="caption" noWrap>
                  0 喜欢
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  ——{" "}
                  <ExcerptCardSource
                    source={(excerpt.extra as Record<string, any>)?.source}
                  />
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
