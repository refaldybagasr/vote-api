import { z } from 'zod';

export const updateUserSchema = z
  .object({
    version: z.number().int().nonnegative(),
    password: z.string().min(8, 'password must be at least 8 characters').optional(),
    role: z.enum(['admin', 'user']).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
