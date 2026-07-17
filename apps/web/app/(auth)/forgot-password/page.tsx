import { redirectToAuthPortal, type AuthRouteSearchParams } from "@/features/auth/auth-route";

export default function ForgotPasswordPage({
	searchParams,
}: {
	searchParams: AuthRouteSearchParams;
}) {
	return redirectToAuthPortal("forgot-password", searchParams);
}
