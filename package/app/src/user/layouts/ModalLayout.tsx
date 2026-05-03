import { Card, CardContent, CardFooter } from "@rezics/ui/shadcn";
import type React from "react";
import type { FC } from "react";

export const ModalLayout: FC<{
  title: string;
  content: React.ReactNode;
  actions: React.ReactNode;
}> = ({ title, content, actions }) => (
  <form>
    <Card className="min-w-full sm:min-w-[384px] lg:min-w-[480px]">
      <CardContent className="flex flex-col gap-4">
        <h4 className="text-2xl font-semibold">{title}</h4>
        {content}
      </CardContent>
      <CardFooter className="flex flex-row justify-end">{actions}</CardFooter>
    </Card>
  </form>
);
