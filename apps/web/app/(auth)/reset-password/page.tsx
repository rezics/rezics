import { redirectToAuthPortal, type AuthRouteSearchParams } from "@/features/auth/auth-route";

export default function ResetPasswordPage({
	searchParams,
}: {
	searchParams: AuthRouteSearchParams;
}) {
	return redirectToAuthPortal("reset-password", searchParams);
}
