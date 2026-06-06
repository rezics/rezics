import type { ImageUploadResponse } from "@rezics/contract";
import { getApiConfig } from "../config";

export const uploadApi = {
  uploadImage: async (file: File): Promise<ImageUploadResponse> => {
    const formData = new FormData();
    formData.append("image", file);

    const url = `${getApiConfig().apiBaseUrl}/upload/image`;
    const response = await fetch(url, {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (!response.ok) {
      const json = await response.json().catch(() => null);
      throw new Error(
        JSON.stringify({
          status: response.status,
          message: json?.message ?? response.statusText,
        }),
      );
    }

    return response.json();
  },
};
