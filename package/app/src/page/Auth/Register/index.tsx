import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import { Layout } from "../lib/Layout";
import { register } from "../lib/handler";
import { string } from "zod";
import { email } from "zod/v4";
import { FC, useState } from "react";
import Alert from "@mui/material/Alert";
import { get } from "@locale";

export const Register: FC = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>();

    return (
        <Layout
            title={get("auth->register")}
            onSubmit={async (event) => {
                event.preventDefault();
                setLoading(true);
                setError(undefined);

                const data = new FormData(event.currentTarget);

                try {
                    const { error: e_name, data: _name } = string().min(1).safeParse(data.get("name"));
                    if (e_name) throw new Error("Invalid user name.");

                    const { error: e_email, data: _email } = email().safeParse(data.get("email"));
                    if (e_email) throw new Error("Invalid email address.");

                    const { error: e_password, data: _password } = string().min(6).safeParse(data.get("password"));
                    if (e_password) throw new Error("Password must be at least 6 characters long.");

                    const { error: e_confirm, data: _confirm } = string().safeParse(data.get("confirm"));
                    if (e_confirm) throw new Error("Invalid password confirmation.");

                    if (_password !== _confirm) throw new Error("Passwords do not match.");

                    await register(_name, _email, _password);
                } catch (e) {
                    setError((e as Error).message);
                } finally {
                    setLoading(false);
                }
            }}
            content={
                <>
                    {error ? <Alert severity="error">{error}</Alert> : undefined}
                    <TextField name="name" type="text" label={get("common->username")} variant="standard"></TextField>
                    <TextField name="email" type="email" label={get("common->email")} variant="standard"></TextField>
                    <TextField
                        name="password"
                        type="password"
                        label={get("common->password")}
                        variant="standard"
                    ></TextField>
                    <TextField
                        name="confirm"
                        type="password"
                        label={get("common->confirm")}
                        variant="standard"
                    ></TextField>
                </>
            }
            actions={
                <>
                    <Button variant="text" type="button" slot="a" href="./login">
                        {get("auth->login")}
                    </Button>
                    <Button type="submit" variant="contained" loading={loading}>
                        {get("auth->register")}
                    </Button>
                </>
            }
        ></Layout>
    );
};
