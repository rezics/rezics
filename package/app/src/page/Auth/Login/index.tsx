import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import { Layout } from "../lib/Layout";
import { login } from "../lib/handler";
import { string } from "zod";
import { email } from "zod/v4";
import { FC, useState } from "react";
import Alert from "@mui/material/Alert";
import { get } from "@locale";

export const Login: FC = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>();

    return (
        <Layout
            title={get("auth->login")}
            onSubmit={async (event) => {
                event.preventDefault();
                setLoading(true);

                const data = new FormData(event.currentTarget);

                try {
                    const { error: e_email, data: _email } = email().safeParse(data.get("email"));
                    if (e_email) throw new Error(get("auth->error->invalid_email"));

                    const { error: e_password, data: _password } = string().safeParse(data.get("password"));
                    if (e_password) throw new Error(get("auth->error->invalid_password"));

                    await login(_email, _password);
                } catch (e) {
                    setError((e as Error).message);
                } finally {
                    setLoading(false);
                }
            }}
            content={
                <>
                    {false ? <Alert severity="warning">{get("auth->already_login")}</Alert> : undefined}
                    {error ? (
                        <Alert severity="error">
                            {error}
                            <br />
                            <Button variant="text" type="button" slot="a" href="./resolve">
                                {get("auth->resolve")}
                            </Button>
                        </Alert>
                    ) : undefined}
                    <TextField name="email" type="email" label={get("common->email")} variant="standard"></TextField>
                    <TextField
                        name="password"
                        type="password"
                        label={get("common->password")}
                        variant="standard"
                    ></TextField>
                </>
            }
            actions={
                <>
                    <Button variant="text" type="button" slot="a" href="./register">
                        {get("auth->register")}
                    </Button>
                    <Button type="submit" variant="contained" loading={loading}>
                        {get("auth->login")}
                    </Button>
                </>
            }
        ></Layout>
    );
};
