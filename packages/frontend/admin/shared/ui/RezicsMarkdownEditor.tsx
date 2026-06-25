import type { UserListQuery } from "@rezics/contract";
import {
  RezicsMarkdownEditor as BaseRezicsMarkdownEditor,
  createRezicsUploadProvider,
  type RezicsMarkdownEditorProps,
  type UserSearchAdapter,
  type ViewMode,
} from "@rezics/ui/editor";
import { useMemo } from "react";
import { apiClient, unwrapEdenResponse } from "@/lib/api-client";

export type { RezicsMarkdownEditorProps, ViewMode };

const searchUsers: UserSearchAdapter = async (query) => {
  const searchQuery: UserListQuery = { q: query, limit: 10 };
  const response = await apiClient.meili.users.search.get({
    query: searchQuery,
  });
  const { users } = unwrapEdenResponse(response);
  return users;
};

async function uploadImage(file: File): Promise<{ url: string }> {
  const response = await apiClient.upload.presign.post({
    contentType: file.type,
    size: file.size,
  });
  const grant = unwrapEdenResponse(response);

  const putResponse = await fetch(grant.uploadUrl, {
    method: "PUT",
    headers: grant.headers,
    body: file,
  });

  if (!putResponse.ok) {
    throw new Error(`Direct upload failed: ${putResponse.status}`);
  }

  return { url: grant.fileUrl };
}

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
