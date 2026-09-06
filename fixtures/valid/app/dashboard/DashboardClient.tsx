'use client';

interface DashboardClientProps {
  items: string[];
}

export const DashboardClient = ({ items }: DashboardClientProps) => (
  <ul>
    {items.map((item) => (
      <li key={item}>{item}</li>
    ))}
  </ul>
);
