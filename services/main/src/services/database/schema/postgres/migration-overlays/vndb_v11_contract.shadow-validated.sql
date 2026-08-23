-- Operators validate these additive checks online after the prepare migration.
-- This shadow-only file records that external state for Atlas diff generation;
-- its restricted statements are never included in a generated migration.
ALTER TABLE public.unit_structure
	VALIDATE CONSTRAINT unit_structure_active_projection_version_check;
ALTER TABLE public.unit_structure_member
	VALIDATE CONSTRAINT unit_structure_member_projection_version_check;
ALTER TABLE public.unit_structure_edge
	VALIDATE CONSTRAINT unit_structure_edge_projection_version_check;
ALTER TABLE public.unit_tag_structure_support
	VALIDATE CONSTRAINT unit_tag_structure_support_projection_version_check;
