import { z } from 'zod';

export const idParamSchema = z
  .object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'must be a valid ObjectId'),
  })
  .strict();
