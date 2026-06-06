import type { ImageUploadResponse } from "@rezics/contract";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { uploadApi } from "./upload.api";

export function useImageUpload(
  options?: Omit<
    UseMutationOptions<ImageUploadResponse, Error, File>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: (file: File) => uploadApi.uploadImage(file),
    ...options,
  });
}
