import { Avatar, Button, Card, CardContent, CardHeader, CircularProgress, Typography } from "@mui/material";
import { useEffect, useState } from "react";

import useRpcQuery from "@/api/swr-query/tsrTypeBuild";

interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  bio: string;
  joinDate: string;
}

interface UserPageProps {
  userId: string;
}

export function UserPage({ userId }: UserPageProps) {
  const createUserInput = {
    operation: "user.read",
    parameter: { id: userId },
    select: {
      id: true,
      name: true,
      avatar: true,
      bio: true,
      joinDate: true,
    },
  };
  const { data, error, isLoading } = useRpcQuery<any>(createUserInput);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <CircularProgress />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <Typography color="error">{error?.message}</Typography>
      </div>
    );
  }

  return (
    <div className="w-11/12 mx-auto mt-10">
      <Card className="shadow-lg rounded-2xl">
        <CardHeader
          avatar={
            <Avatar
              src={data?.avatar}
              sx={{ width: 64, height: 64 }}
            />
          }
          title={
            <Typography variant="h5" className="font-semibold">
              {data?.name}
            </Typography>
          }
          subheader={
            <Typography variant="body2" color="textSecondary">
              Joined on {data?.joinDate}
            </Typography>
          }
          action={<Button variant="contained">Follow</Button>}
        />
        <CardContent>
          <Typography variant="subtitle1" className="mb-2">
            Email
          </Typography>
          <Typography
            variant="body2"
            color="textSecondary"
            className="mb-4"
          >
            {data?.email}
          </Typography>

          <Typography variant="subtitle1" className="mb-2">
            Bio
          </Typography>
          <Typography variant="body1" className="text-gray-700">
            {data?.bio}
          </Typography>
        </CardContent>
      </Card>
    </div>
  );
}
