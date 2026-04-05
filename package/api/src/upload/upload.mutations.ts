import {useMutation, type UseMutationOptions} from '@tanstack/react-query';
import {uploadApi} from './upload.api';
import type {ImageUploadResponse} from '@rezics/contract';

export function useImageUpload(
  options?: Omit<
    UseMutationOptions<ImageUploadResponse, Error, File>,
    'mutationFn'
  >,
) {
  return useMutation({
    mutationFn: (file: File) => uploadApi.uploadImage(file),
    ...options,
  });
}
