export type PostEditorSurfaceDraft = {
  language: string;
  title: string;
  body: string;
};

export function isPostEditorSurfaceSubmittable(
  draft: Pick<PostEditorSurfaceDraft, "title" | "body">,
) {
  return Boolean(draft.title.trim() && draft.body.trim());
}
