import { DashboardClient } from './DashboardClient';

const Page = async () => {
  const items = await Promise.resolve(['a', 'b']);
  return <DashboardClient items={items} />;
};

export default Page;
