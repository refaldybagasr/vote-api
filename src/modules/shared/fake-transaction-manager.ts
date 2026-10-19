import type { TransactionManager, TxContext } from './transaction-manager';

export class FakeTransactionManager implements TransactionManager {
  async run<T>(fn: (ctx: TxContext) => Promise<T>): Promise<T> {
    return fn({} as TxContext);
  }
}
