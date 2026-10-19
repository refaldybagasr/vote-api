import { z } from 'zod';

export const castVoteSchema = z
  .object({
    candidateId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'must be a valid ObjectId').optional(),
    name: z.string().min(1).max(200).optional(),
  })
  .strict()
  .refine((data) => (data.candidateId !== undefined) !== (data.name !== undefined), {
    message: 'Provide exactly one of candidateId or name',
  });
