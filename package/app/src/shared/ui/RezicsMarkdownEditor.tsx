import { meiliUserApi } from "@rezics/api/meili/meili.api";
import { uploadApi } from "@rezics/api/upload/upload.api";
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
  const { users } = await meiliUserApi.userSearch({ q: query, limit: 10 });
  return users;
};

export function RezicsMarkdownEditor(props: RezicsMarkdownEditorProps) {
  const imageProviders = useMemo(
    () => [createRezicsUploadProvider(uploadApi.uploadImage)],
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
