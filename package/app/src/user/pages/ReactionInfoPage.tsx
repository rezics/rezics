import { Button, Typography } from "@mui/material";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";

// MOCK: Reaction history page — waiting on reaction service /reactions/history endpoint
export const ReactionInfoPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="w-11/12 mx-auto mt-16 px-4">
      <div className="flex items-center justify-between">
        <div className="mb-4">
          <Typography variant="h5" className="font-bold mb-2">
            互动信息
          </Typography>
          <Typography variant="body2" color="textSecondary">
            查看你对内容的互动记录。
          </Typography>
        </div>
        <Button
          variant="text"
          color="primary"
          onClick={() => navigate({ to: "/user/me" })}
        >
          返回
        </Button>
      </div>

      <div className="py-16 text-center text-gray-500">
        互动历史功能正在迁移中，请稍后再来。
      </div>
    </div>
  );
};

export default ReactionInfoPage;
