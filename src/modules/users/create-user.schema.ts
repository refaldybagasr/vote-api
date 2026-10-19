import { z } from 'zod';

export const createUserSchema = z
  .object({
    username: z.string().regex(/^[a-zA-Z0-9_.]{3,30}$/, 'invalid username'),
    password: z.string().min(8, 'password must be at least 8 characters'),
    role: z.enum(['admin', 'user']),
  })
  .strict();
