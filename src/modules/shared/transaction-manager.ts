import mongoose from 'mongoose';

export interface TxContext {
  session: mongoose.ClientSession;
}

/**
 * Builds a mongoose options object carrying the session only when a TxContext was
 * given — with `exactOptionalPropertyTypes`, `{ session: undefined }` is a different
 * (and rejected) type from simply omitting the key.
 */
export function sessionOptions(ctx?: TxContext): { session: mongoose.ClientSession } | Record<string, never> {
  return ctx ? { session: ctx.session } : {};
}

export interface TransactionManager {
  run<T>(fn: (ctx: TxContext) => Promise<T>): Promise<T>;
}

export class MongooseTransactionManager implements TransactionManager {
  constructor(private readonly connection: mongoose.Connection = mongoose.connection) {}

  async run<T>(fn: (ctx: TxContext) => Promise<T>): Promise<T> {
    const session = await this.connection.startSession();
    try {
      let result: T | undefined;
      await session.withTransaction(async () => {
        result = await fn({ session });
      });
      return result as T;
    } finally {
      await session.endSession();
    }
  }
}
