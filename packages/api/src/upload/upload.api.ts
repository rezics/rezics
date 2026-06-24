import type { PresignUploadResponse } from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export const uploadApi = {
  uploadImage: async (file: File): Promise<{ url: string }> => {
    const grant = await apiFetch<PresignUploadResponse>("/upload/presign", {
      method: "POST",
      body: JSON.stringify({
        contentType: file.type,
        size: file.size,
      }),
    });

    const putResponse = await fetch(grant.uploadUrl, {
      method: "PUT",
      headers: grant.headers,
      body: file,
    });

    if (!putResponse.ok) {
      throw new Error(`Direct upload failed: ${putResponse.status}`);
    }

    return { url: grant.fileUrl };
  },
};
