import { Avatar, Button, Card, CardContent, CardHeader, CircularProgress, Typography } from "@mui/material";
import React, { useEffect, useState } from "react";

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

// 模拟通过 userId 获取数据
function fetchUserData(userId: string): Promise<User> {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                id: userId,
                name: `User ${userId}`,
                email: `user${userId}@example.com`,
                avatarUrl: `https://i.pravatar.cc/150?u=${userId}`,
                bio: "This is a short bio describing the user. It can include interests, background, or any other relevant information.",
                joinDate: "2022-01-15",
            });
        }, 1000);
    });
}

export function UserPage({ userId }: UserPageProps) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        fetchUserData(userId)
            .then((data) => {
                setUser(data);
                setLoading(false);
            })
            .catch(() => {
                setError("Failed to load user data.");
                setLoading(false);
            });
    }, [userId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <CircularProgress />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-64">
                <Typography color="error">{error}</Typography>
            </div>
        );
    }

    return (
        <div className="w-11/12 mx-auto mt-10">
            <Card className="shadow-lg rounded-2xl">
                <CardHeader
                    avatar={
                        <Avatar
                            src={user?.avatarUrl}
                            sx={{ width: 64, height: 64 }}
                        />
                    }
                    title={
                        <Typography variant="h5" className="font-semibold">
                            {user?.name}
                        </Typography>
                    }
                    subheader={
                        <Typography variant="body2" color="textSecondary">
                            Joined on {user?.joinDate}
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
                        {user?.email}
                    </Typography>

                    <Typography variant="subtitle1" className="mb-2">
                        Bio
                    </Typography>
                    <Typography variant="body1" className="text-gray-700">
                        {user?.bio}
                    </Typography>
                </CardContent>
            </Card>
        </div>
    );
}
