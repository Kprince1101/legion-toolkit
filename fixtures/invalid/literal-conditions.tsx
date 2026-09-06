interface BadgeProps {
  slug: string;
  status: string;
  count: number;
}

export const Badge = ({ slug, status, count }: BadgeProps) => (
  <div>
    {slug === '42-kitchen' && <span>demo</span>}
    <em className={status !== 'won' && 'muted'}>{status}</em>
    {count > 0 && <strong>{count}</strong>}
  </div>
);
