import { Typography } from "@mui/material";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import type React from "react";
import type { FC } from "react";

export const Layout: FC<{
  title: string;
  content: React.ReactNode;
  actions: React.ReactNode;
}> = ({ title, content, actions }) => (
  <div className="w-full h-dvh flex flex-col items-center justify-center">
    <Card className="min-w-full sm:min-w-[384px] lg:min-w-[480px]">
      <CardContent className="flex flex-col gap-4">
        <Typography variant="h4">{title}</Typography>
        {content}
      </CardContent>
      <CardActions className="flex flex-row justify-end">{actions}</CardActions>
    </Card>
  </div>
);
