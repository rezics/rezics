-- The former intrinsic-duration field has been replaced by a source-qualified playtime estimate.
-- Drop its column-specific trigger before the generated column removal.
DROP TRIGGER IF EXISTS software_visual_novel_length_type_vocab_guard ON public.software_visual_novel;
