import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import { Layout } from "../Layout";
import { login } from "../handler";
import { string } from "zod";
import { email } from "zod/v4";
import { useContext, useState } from "react";
import Alert from "@mui/material/Alert";
import { User } from "../../../init";

export const Login = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>();
    const user = useContext(User);

    return (
        <Layout
            title="Login"
            onSubmit={async (event) => {
                event.preventDefault();
                setLoading(true);

                const data = new FormData(event.currentTarget);

                try {
                    const { error: e_email, data: _email } = email().safeParse(data.get("email"));
                    if (e_email) throw new Error("Invalid email address.");

                    const { error: e_password, data: _password } = string().safeParse(data.get("password"));
                    if (e_password) throw new Error("Invalid password.");

                    await login(_email, _password);
                } catch (e) {
                    setError((e as Error).message);
                } finally {
                    setLoading(false);
                }
            }}
        >
            {user ? (
                <Alert severity="warning">
                    You have already login.
                    <br />
                    Re-login will overwrite the previous login information.
                </Alert>
            ) : undefined}
            {error ? (
                <Alert severity="error">
                    {error}
                    <br />
                    Have some probelmihjiuhhhihihijijiijijihihihi
                    <Button type="button" slot="a" href="./resolve">
                        Resolve
                    </Button>
                </Alert>
            ) : undefined}
            <TextField name="email" type="email" label="Email"></TextField>
            <TextField name="password" type="password" label="Password"></TextField>
            <div className="flex flex-row justify-between">
                <Button type="button" slot="a" href="./register" size="large">
                    Register
                </Button>
                <Button type="submit" variant="contained" size="large" loading={loading}>
                    Submit
                </Button>
            </div>
        </Layout>
    );
};
