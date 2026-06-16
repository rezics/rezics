import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { uploadApi } from "./upload.api";

type ImageUploadResult = { url: string };

export function useImageUpload(
  options?: Omit<
    UseMutationOptions<ImageUploadResult, Error, File>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: (file: File) => uploadApi.uploadImage(file),
    ...options,
  });
}
