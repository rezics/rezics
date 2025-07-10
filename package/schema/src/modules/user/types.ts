import { z } from 'zod/v4';
import { ID, String } from '../../base';

export const User = z.object({
  id: ID,
  name: String,
  avatar: String,
});

export const Author = z.object({
  name: String,
  avatar: String,
  description: String,
});

export const AuthPayload = z.object({
  token: String,
  user: User,
});

export const ValidationError = z.object({
  field: String,
  message: String,
});

export type User = z.infer<typeof User>;
export type Author = z.infer<typeof Author>;
export type AuthPayload = z.infer<typeof AuthPayload>;
export type ValidationError = z.infer<typeof ValidationError>;