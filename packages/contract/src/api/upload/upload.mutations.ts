import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { uploadApi } from "./upload.api";

export type ImageUploadResult = { url: string };

export function uploadImage(file: File): Promise<ImageUploadResult> {
  return uploadApi.uploadImage(file);
}

export function useImageUpload(
  options?: Omit<
    UseMutationOptions<ImageUploadResult, Error, File>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: uploadImage,
    ...options,
  });
}
