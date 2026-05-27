import { StaffConsolePage } from "@/staff";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_mainLayout/staff/")({
  component: StaffConsolePage,
});
