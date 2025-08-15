import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import { Layout } from "../lib/Layout";
import { register } from "../lib/handler";
import { string } from "zod";
import { email } from "zod/v4";
import { FC, useState } from "react";
import Alert from "@mui/material/Alert";
import { useTranslation } from "react-i18next";

export const Register: FC = () => {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string>();
	const { t } = useTranslation();

	return (
		<Layout
			title={t("auth.register")}
			onSubmit={async (event) => {
				event.preventDefault();
				setLoading(true);
				setError(undefined);

				const data = new FormData(event.currentTarget);

				try {
					const { error: e_name, data: _name } = string().min(1)
						.safeParse(data.get("name"));
					if (e_name) {
						throw new Error(t("auth.error.invalid_username"));
					}

					const { error: e_email, data: _email } = email().safeParse(
						data.get("email"),
					);
					if (e_email) throw new Error(t("auth.error.invalid_email"));

					const { error: e_password, data: _password } = string().min(
						6,
					).safeParse(data.get("password"));
					if (e_password) {
						throw new Error(
							t("auth.error.invalid_password"),
						);
					}

					const { error: e_confirm, data: _confirm } = string()
						.safeParse(data.get("confirm"));
					if (e_confirm) {
						throw new Error(t("auth.error.invalid_confirm"));
					}

					if (_password !== _confirm) {
						throw new Error(
							t("auth.error.passwords_mismatch"),
						);
					}

					await register(_name, _email, _password);
				} catch (e) {
					setError((e as Error).message);
				} finally {
					setLoading(false);
				}
			}}
			content={
				<>
					{error
						? <Alert severity="error">{error}</Alert>
						: undefined}
					<TextField
						name="name"
						type="text"
						label={t("common.username")}
						variant="standard"
					>
					</TextField>
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
					<TextField
						name="confirm"
						type="password"
						label={t(`common.confirm`)}
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
						href="./login"
					>
						{t("auth.login")}
					</Button>
					<Button type="submit" variant="contained" loading={loading}>
						{t("auth.register")}
					</Button>
				</>
			}
		>
		</Layout>
	);
};
