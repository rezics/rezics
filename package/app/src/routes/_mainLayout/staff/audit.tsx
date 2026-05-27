import { StaffAuditPage } from "@/staff";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_mainLayout/staff/audit")({
  component: StaffAuditPage,
});
