export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export const handlers = {
  onSelect: function (id: string) {
    return id;
  },
};

export default function Page() {
  return null;
}
