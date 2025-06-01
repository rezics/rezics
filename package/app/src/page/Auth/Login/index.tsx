import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import { Layout, login } from "../lib";
import { string } from "zod";
import { email } from "zod/v4";

export const Login = () => {
    return (
        <Layout
            title="Login"
            onSubmit={async (event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);

                try {
                    await login(email().parse(data.get("email")), string().parse(data.get("password")));
                } catch (e) {}
            }}
        >
            <TextField type="email" label="Email" variant="standard"></TextField>
            <TextField type="password" label="Password" variant="standard"></TextField>
            <div className="flex flex-row justify-between">
                <Button type="button" slot="a" href="./register">
                    Register
                </Button>
                <Button type="submit">Submit</Button>
            </div>
        </Layout>
    );
};
