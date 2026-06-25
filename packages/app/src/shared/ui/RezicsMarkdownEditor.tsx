import { userSearch } from "@rezics/contract/api/meili/meili.queries";
import { uploadImage } from "@rezics/contract/api/upload/upload.mutations";
import {
  RezicsMarkdownEditor as BaseRezicsMarkdownEditor,
  createRezicsUploadProvider,
  type RezicsMarkdownEditorProps,
  type UserSearchAdapter,
  type ViewMode,
} from "@rezics/ui/editor";
import { useMemo } from "react";

export type { RezicsMarkdownEditorProps, ViewMode };

const searchUsers: UserSearchAdapter = async (query) => {
  const { users } = await userSearch({ q: query, limit: 10 });
  return users;
};

export function RezicsMarkdownEditor(props: RezicsMarkdownEditorProps) {
  const imageProviders = useMemo(
    () => [createRezicsUploadProvider(uploadImage)],
    [],
  );

  return (
    <BaseRezicsMarkdownEditor
      userSearch={searchUsers}
      imageProviders={imageProviders}
      {...props}
    />
  );
}
