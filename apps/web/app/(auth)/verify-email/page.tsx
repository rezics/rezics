import { redirectToAuthPortal, type AuthRouteSearchParams } from "@/features/auth/auth-route";

export default function VerifyEmailPage({ searchParams }: { searchParams: AuthRouteSearchParams }) {
	return redirectToAuthPortal("verify-email", searchParams);
}
