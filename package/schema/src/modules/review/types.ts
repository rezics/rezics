import { z } from 'zod/v4';
import { ID, String, Float, DateString } from '../../base';
import { User } from '../user';

export const Review = z.object({
  id: ID,
  content: String,
  rating: Float,
  createdAt: DateString,
  user: User,
});

export type Review = z.infer<typeof Review>;