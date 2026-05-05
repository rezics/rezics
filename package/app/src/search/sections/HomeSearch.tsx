import type React from "react";
import LogoIcon from "@/shared/assets/logo.svg?react";
import { TextSearchInput } from "../components/TextSearchInput";
import { useHomeSearchNavigate } from "../hooks/useHomeSearchNavigate";
export const HomeSearch: React.FC<{ className?: string }> = ({ className }) => {
  const { navigateByKeyword } = useHomeSearchNavigate();

  return (
    <div className={className}>
      <TextSearchInput
        height={40}
        defaultValue={{ keyword: "" }}
        onSearch={navigateByKeyword}
        enableSuggestions={true}
        startAdornmentIcon={<LogoIcon className="w-8 h-8" />}
      />
    </div>
  );
};
