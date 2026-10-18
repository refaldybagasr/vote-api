import { getScaffoldStatus } from '../server';

describe('scaffold smoke test', () => {
  it('confirms the TypeScript + Jest pipeline runs', () => {
    expect(getScaffoldStatus()).toBe('vote-api scaffold ready');
  });
});
