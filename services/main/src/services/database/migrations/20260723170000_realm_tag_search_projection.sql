-- Realm-scoped Tag context identity is projected into the current search
-- document. Vote aggregates stay outside the projection and are rechecked
-- authoritatively in PostgreSQL, so aggregate-only changes need no reindex.
CREATE TRIGGER "search_projection_touch_realm_tag_context_insert"
AFTER INSERT ON "realm_tag_context"
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT
EXECUTE FUNCTION "search_touch_current_statement"('unit_id');

CREATE TRIGGER "search_projection_touch_realm_tag_context_update"
AFTER UPDATE ON "realm_tag_context"
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
FOR EACH STATEMENT
EXECUTE FUNCTION "search_touch_current_statement"('unit_id');

CREATE TRIGGER "search_projection_touch_realm_tag_context_delete"
AFTER DELETE ON "realm_tag_context"
REFERENCING OLD TABLE AS old_rows
FOR EACH STATEMENT
EXECUTE FUNCTION "search_touch_current_statement"('unit_id');
