import FormatQuoteRoundedIcon from "@mui/icons-material/FormatQuoteRounded";
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Typography,
  useTheme,
} from "@mui/material";
import type { UnitDTO } from "@rezics/contract";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { cn } from "@/shared/util/css-util";

export interface QuoteCardProps {
  quote: UnitDTO;
  className?: string;
}

const QuoteCard: React.FC<QuoteCardProps> = ({ quote, className }) => {
  const theme = useTheme();
  const navigate = useNavigate();

  const handleOpenQuote = () => {
    if (!quote.id) return;
    navigate({ to: "/quote/$unitId", params: { unitId: quote.id } });
  };

  return (
    <Card elevation={0} className={cn("w-full transition-all mb-1", className)}>
      <CardActionArea onClick={handleOpenQuote} disabled={!quote.id}>
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
                {quote.translations?.[0]?.description || "暂无摘录内容"}
              </Typography>

              <Box className="mt-3 flex items-center justify-between gap-2">
                <Typography variant="caption" noWrap>
                  0 喜欢
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  —— {(quote.extra as Record<string, any>)?.source || "未知出处"}
                </Typography>
              </Box>
            </Box>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

export default QuoteCard;
