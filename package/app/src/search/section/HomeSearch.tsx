import { SvgIcon } from "@mui/material";
import type React from "react";
import LogoIcon from "@/shared/asset/logo.svg?react";
import { TextSearchInput } from "../component/TextSearchInput";
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
        startAdornmentIcon={
          <SvgIcon
            component={LogoIcon}
            sx={{ width: 32, height: 32 }}
            inheritViewBox
          />
        }
      />
    </div>
  );
};
