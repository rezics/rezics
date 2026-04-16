import { useState } from "react";
import Alert from "@mui/material/Alert";
import Collapse from "@mui/material/Collapse";
import Typography from "@mui/material/Typography";
import { ApiError } from "@rezics/api";

interface QueryErrorDisplayProps {
  error: Error | null;
  className?: string;
}

export function QueryErrorDisplay({ error, className }: QueryErrorDisplayProps) {
  const [detailOpen, setDetailOpen] = useState(false);

  if (!error) return null;

  const isApiError = error instanceof ApiError;
  const message = error.message || "An unexpected error occurred";
  const prismaDetail = isApiError ? error.detail?.prisma : undefined;
  const hasDetail = isApiError && (prismaDetail || error.status);

  return (
    <Alert severity="error" className={className}>
      <Typography variant="body2">{message}</Typography>
      {hasDetail && (
        <>
          <Typography
            variant="caption"
            onClick={() => setDetailOpen((v) => !v)}
            sx={{
              cursor: "pointer",
              userSelect: "none",
              mt: 0.5,
              display: "block",
              color: "text.secondary",
            }}
          >
            {detailOpen ? "▾" : "▸"} Technical details
          </Typography>
          <Collapse in={detailOpen}>
            <Typography
              variant="caption"
              component="div"
              sx={{ mt: 0.5, fontFamily: "monospace", color: "text.secondary" }}
            >
              {prismaDetail && (
                <>
                  <div>Prisma {prismaDetail.code}</div>
                  {prismaDetail.model && <div>Model: {prismaDetail.model}</div>}
                  {prismaDetail.target && (
                    <div>Target: {prismaDetail.target.join(", ")}</div>
                  )}
                </>
              )}
              <div>HTTP {error.status}</div>
            </Typography>
          </Collapse>
        </>
      )}
    </Alert>
  );
}
