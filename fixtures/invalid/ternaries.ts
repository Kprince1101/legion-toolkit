export const label = (count: number) => (count === 1 ? 'item' : 'items');

export const pick = (value: string | undefined, fallback: string) =>
  value ? value : fallback;

export const nested = (a: boolean, b: boolean) => (a ? (b ? 1 : 2) : 3);
