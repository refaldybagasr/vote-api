import { z } from 'zod';

export const createCandidateSchema = z
  .object({
    name: z.string().min(1).max(200),
  })
  .strict();
