CREATE FUNCTION reject_immutable_history_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;--> statement-breakpoint
CREATE TRIGGER audit_event_append_only
	BEFORE UPDATE OR DELETE ON "audit_event"
	FOR EACH ROW EXECUTE FUNCTION reject_immutable_history_mutation();--> statement-breakpoint
CREATE TRIGGER revision_content_immutable
	BEFORE UPDATE OR DELETE ON "revision_content"
	FOR EACH ROW EXECUTE FUNCTION reject_immutable_history_mutation();--> statement-breakpoint
CREATE TRIGGER unit_revision_slot_immutable
	BEFORE UPDATE OR DELETE ON "unit_revision_slot"
	FOR EACH ROW EXECUTE FUNCTION reject_immutable_history_mutation();--> statement-breakpoint
CREATE TRIGGER unit_revision_tag_immutable
	BEFORE UPDATE OR DELETE ON "unit_revision_tag"
	FOR EACH ROW EXECUTE FUNCTION reject_immutable_history_mutation();--> statement-breakpoint
CREATE FUNCTION protect_unit_revision_identity() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	IF ROW(
		OLD."id",
		OLD."unit_id",
		OLD."parent_revision_id",
		OLD."actor_profile_id",
		OLD."edit_summary",
		OLD."minor",
		OLD."byte_size",
		OLD."created_at"
	) IS DISTINCT FROM ROW(
		NEW."id",
		NEW."unit_id",
		NEW."parent_revision_id",
		NEW."actor_profile_id",
		NEW."edit_summary",
		NEW."minor",
		NEW."byte_size",
		NEW."created_at"
	) THEN
		RAISE EXCEPTION 'unit_revision identity is immutable' USING ERRCODE = '55000';
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER unit_revision_identity_immutable
	BEFORE UPDATE ON "unit_revision"
	FOR EACH ROW EXECUTE FUNCTION protect_unit_revision_identity();
