export function getScaffoldStatus(): string {
  return 'vote-api scaffold ready';
}

/* istanbul ignore next */
if (require.main === module) {
  console.log(getScaffoldStatus());
}
