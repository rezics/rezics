import { Typography } from "@mui/material";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import { FC, PropsWithChildren } from "react";
import { Account } from "appwrite";
import { appwrite } from "../../init";

export const Layout: FC<{ title: string; onSubmit: React.FormEventHandler<HTMLFormElement> } & PropsWithChildren> = ({
    title,
    onSubmit,
    children,
}) => (
    <div className="w-full h-dvh flex flex-col items-center justify-center">
        <Card className="min-w-md">
            <CardContent className="flex flex-col gap-4">
                <Typography variant="h3">{title}</Typography>
                <form onSubmit={onSubmit} className="contents">
                    {children}
                </form>
            </CardContent>
        </Card>
    </div>
);

export const login = async (email: string, password: string) => {
    const account = new Account(appwrite);

    return await account.createEmailPasswordSession(email, password);
};
