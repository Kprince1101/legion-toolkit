// Renders the menu header for the current restaurant
import { useMenuHeader } from './useMenuHeader';

interface MenuHeaderProps {
  slug: string;
}

/* Legacy: keep until the new header ships */
export const MenuHeader = ({ slug }: MenuHeaderProps) => {
  const { title } = useMenuHeader(slug);
  return <h1>{title}</h1>;
};

export const noop = () => {
  /* intentionally empty */
};
