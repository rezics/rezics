import { ChevronRight as ArrowForwardIosRoundedIcon } from "lucide-react";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import type React from "react";

export type ArrowForwardIconProps = {
  size?: number;
  color?: string;
  children?: React.ReactNode;
  to?: string;
};

export const ArrowForwardIcon: React.FC<ArrowForwardIconProps> = ({
  children,
  to,
}) => {
  return (
    <Link to={to || "/"}>
      <span
        className={[
          "inline-flex items-center cursor-pointer text-text-primary",
          "transition-colors duration-200 ease-out",
          "[&_.arrow-icon]:text-on-base [&_.arrow-icon]:transition-[color,transform] [&_.arrow-icon]:duration-200 [&_.arrow-icon]:ease-out",
          "hover:[&_.arrow-icon]:text-brand hover:[&_.arrow-icon]:scale-110",
        ].join(" ")}
      >
        <span>{children}</span>
        <ArrowForwardIosRoundedIcon
          className="arrow-icon ml-0.5 font-black leading-tight !text-base"
          style={{ fontSize: 24 }}
        />
      </span>
    </Link>
  );
};
