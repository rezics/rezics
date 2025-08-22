import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import { type FC, useState } from "react";
import type React from "react";
import { useTranslation } from "react-i18next";
import { string, z } from "zod";
import { register } from "./lib/handler.ts";
import { Layout } from "./lib/Layout.tsx";
import { ModalLayout } from "./lib/ModalLayout.tsx";

export interface RegisterShowProps {
	loading: boolean;
	error?: string;
	onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
	hideActions?: boolean;
	onLoginClick?: () => void;
	isModal?: boolean;
}

/**
 * RegisterShow - 注册表单展示组件
 * 可以在页面布局中使用，也可以在 Modal 中展示
 */
export const RegisterShow: FC<RegisterShowProps> = ({
	loading,
	error,
	onSubmit,
	hideActions = false,
	onLoginClick,
	isModal = false,
}) => {
	const { t } = useTranslation();

	const content = (
		<>
			{error && <Alert severity="error">{error}</Alert>}
			<TextField
				name="name"
				type="text"
				label={t("common.username")}
				variant="standard"
				required
			/>
			<TextField
				name="email"
				type="email"
				label={t("common.email")}
				variant="standard"
				required
			/>
			<TextField
				name="password"
				type="password"
				label={t("common.password")}
				variant="standard"
				required
			/>
			<TextField
				name="confirm"
				type="password"
				label={t("common.confirm")}
				variant="standard"
				required
			/>
		</>
	);

	const actions = !hideActions && (
		<>
			<Button
				variant="text"
				type="button"
				onClick={onLoginClick}
			>
				{t("auth.login")}
			</Button>
			<Button
				type="submit"
				variant="contained"
				disabled={loading}
			>
				{loading ? "Loading..." : t("auth.register")}
			</Button>
		</>
	);

	const LayoutComponent = isModal ? ModalLayout : Layout;

	return (
		<LayoutComponent
			title={t("auth.register")}
			onSubmit={onSubmit}
			content={content}
			actions={actions}
		/>
	);
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface RegisterPageProps {}

/**
 * RegisterPage - 完整的注册页面容器
 * 包含状态管理和表单处理逻辑
 */
export const RegisterPage: FC<RegisterPageProps> = () => {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string>();
	const { t } = useTranslation();

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setLoading(true);
		setError(undefined);

		const form = event.currentTarget as HTMLFormElement;
		const data = new FormData();
		// TODO: Remove hardcoded values
		// data.append("name", "test");
		// data.append("email", "test@test.com");
		// data.append("password", "123456");
		// data.append("confirm", "123456");

		try {
			const { error: e_name, data: _name } = string().min(1)
				.safeParse(data.get("name"));
			if (e_name) {
				throw new Error(t("auth.error.invalid_username"));
			}

			const { error: e_email, data: _email } = z.string().email()
				.safeParse(
					data.get("email"),
				);
			if (e_email) throw new Error(t("auth.error.invalid_email"));

			const { error: e_password, data: _password } = string().min(6)
				.safeParse(data.get("password"));
			if (e_password) {
				throw new Error(t("auth.error.invalid_password"));
			}

			const { error: e_confirm, data: _confirm } = string()
				.safeParse(data.get("confirm"));
			if (e_confirm) {
				throw new Error(t("auth.error.invalid_confirm"));
			}

			if (_password !== _confirm) {
				throw new Error(t("auth.error.passwords_mismatch"));
			}

			await register(_name, _email, _password);
			// TODO: Handle successful registration (redirect, show success message, etc.)
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setLoading(false);
		}
	};

	const handleLoginClick = () => {
		// TODO: Navigate to login page
		window.location.href = "/login";
	};

	return (
		<RegisterShow
			loading={loading}
			error={error}
			onSubmit={handleSubmit}
			onLoginClick={handleLoginClick}
		/>
	);
};
