import { Card, CardContent, CardFooter } from "@rezics/ui/shadcn";
import type React from "react";
import type { FC } from "react";

export const Layout: FC<{
  title: string;
  content: React.ReactNode;
  actions: React.ReactNode;
}> = ({ title, content, actions }) => (
  <div className="w-full h-dvh flex flex-col items-center justify-center">
    <Card surface="contained" className="w-full max-w-[480px] mx-4 sm:mx-0">
      <CardContent className="flex flex-col gap-4">
        <h4 className="text-2xl font-semibold">{title}</h4>
        {content}
      </CardContent>
      <CardFooter className="flex flex-row justify-end">{actions}</CardFooter>
    </Card>
  </div>
);
