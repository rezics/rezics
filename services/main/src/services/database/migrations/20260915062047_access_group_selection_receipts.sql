SET search_path TO public;

ALTER TABLE "access_group_admission_receipt" ADD COLUMN "membership_id" uuid;
ALTER TABLE "access_group_admission_receipt" ADD COLUMN "generation" bigint;
ALTER TABLE "access_group_admission_receipt" ADD COLUMN "group_operation_id" uuid GENERATED ALWAYS AS (case when membership_id is null then operation_id else null end) STORED;
ALTER TABLE "access_group_admission_receipt" ADD CONSTRAINT "access_group_admission_receipt_d4m7sAXLyQyC_fkey" FOREIGN KEY ("membership_id","generation","group_id","operation_id") REFERENCES "access_group_membership_event"("membership_id","generation","group_id","operation_id") ON DELETE RESTRICT;
ALTER TABLE "access_group_admission_receipt" DROP CONSTRAINT "access_group_admission_receipt_0o7aOReEQy7V_fkey", ADD CONSTRAINT "access_group_admission_receipt_0o7aOReEQy7V_fkey" FOREIGN KEY ("group_id","group_operation_id") REFERENCES "access_group_event"("group_id","operation_id") ON DELETE RESTRICT;
ALTER TABLE "access_group_admission_receipt" ADD CONSTRAINT "access_group_admission_selection_check" CHECK (("membership_id" is null and "generation" is null) or ("membership_id" is not null and "generation" is not null and "generation" between 1 and 9007199254740991));
