'use client';

import { useDashboard } from './useDashboard';

const Page = () => {
  const { items } = useDashboard();
  return <ul>{items}</ul>;
};

export default Page;
