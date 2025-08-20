import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import { FC, useState } from "react";
import { useTranslation } from "react-i18next";
import { string } from "zod";
import { email } from "zod/v4";
import { login } from "../lib/handler.ts";
import { Layout } from "../lib/Layout.tsx";

export namespace Login {
    export type Show = {
        loading: boolean;
        error?: string;
        onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
    };

    export const Show: FC<Show> = ({ loading, error, onSubmit }) => {
        const { t } = useTranslation();
        return (
            <Layout
                title={t("auth.login")}
                onSubmit={onSubmit}
                content={
                    <>
                        {false
                            ? (
                                <Alert severity="warning">
                                    {t("auth.already_login")}
                                </Alert>
                            )
                            : undefined}
                        {error
                            ? (
                                <Alert severity="error">
                                    {error}
                                    <br />
                                    <Button
                                        variant="text"
                                        type="button"
                                        slot="a"
                                        href="./resolve"
                                    >
                                        {t("auth.resolve")}
                                    </Button>
                                </Alert>
                            )
                            : undefined}
                        <TextField
                            name="email"
                            type="email"
                            label={t("common.email")}
                            variant="standard"
                        >
                        </TextField>
                        <TextField
                            name="password"
                            type="password"
                            label={t("common.password")}
                            variant="standard"
                        >
                        </TextField>
                    </>
                }
                actions={
                    <>
                        <Button
                            variant="text"
                            type="button"
                            slot="a"
                            href="./register"
                        >
                            {t("auth.register")}
                        </Button>
                        <Button
                            type="submit"
                            variant="contained"
                            loading={loading}
                        >
                            {t("auth.login")}
                        </Button>
                    </>
                }
            >
            </Layout>
        );
    };

    export type Container = {};

    export const Container: FC<Container> = () => {
        const [loading, setLoading] = useState(false);
        const [error, setError] = useState<string>();
        const { t } = useTranslation();

        const handleSubmit = async (
            event: React.FormEvent<HTMLFormElement>,
        ) => {
            event.preventDefault();
            setLoading(true);

            // const data = new FormData(event.currentTarget);
            const data = new FormData();
            data.append("email", "test@test.com");
            data.append("password", "123456");

            try {
                const { error: e_email, data: _email } = email().safeParse(
                    data.get("email"),
                );
                if (e_email) throw new Error(t("auth.error.invalid_email"));

                const { error: e_password, data: _password } = string()
                    .safeParse(data.get("password"));
                if (e_password) {
                    throw new Error(t("auth.error.invalid_password"));
                }

                await login(_email, _password);
            } catch (e) {
                setError((e as Error).message);
            } finally {
                setLoading(false);
            }
        };

        return <Show loading={loading} error={error} onSubmit={handleSubmit} />;
    };
}
