import { z } from 'zod';

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export function errorExample(code: string, message: string) {
  return { error: { code, message } };
}

export const publicUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  role: z.enum(['admin', 'user']),
});

export const authResultSchema = z.object({
  accessToken: z.string(),
  user: publicUserSchema,
});

export const userListItemSchema = publicUserSchema.extend({
  isActive: z.boolean(),
  hasVoted: z.boolean(),
  createdAt: z.coerce.date(),
});

export const userListResponseSchema = z.object({
  items: z.array(userListItemSchema),
  page: z.number(),
  limit: z.number(),
  total: z.number(),
});

export const candidateSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const voteSchema = z.object({
  candidateId: z.string(),
  candidateName: z.string(),
  createdAt: z.coerce.date(),
});

export const voteStatusSchema = z.object({
  hasVoted: z.boolean(),
  vote: voteSchema.nullable(),
});

export const resultsResponseSchema = z.object({
  totalVotes: z.number(),
  results: z.array(
    z.object({
      candidateId: z.string(),
      name: z.string(),
      votes: z.number(),
      percentage: z.number(),
    }),
  ),
});
