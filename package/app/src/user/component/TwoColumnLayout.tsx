import type { FC, ReactNode } from "react";

interface TwoColumnLayoutProps {
  sidebar: ReactNode;
  main: ReactNode;
  className?: string;
}

export const TwoColumnLayout: FC<TwoColumnLayoutProps> = ({
  sidebar,
  main,
  className,
}) => (
  <div
    className={`flex flex-col md:flex-row md:gap-8 ${className ?? ""}`}
  >
    <aside className="w-full md:w-[280px] md:shrink-0">{sidebar}</aside>
    <div className="min-w-0 flex-1">{main}</div>
  </div>
);
