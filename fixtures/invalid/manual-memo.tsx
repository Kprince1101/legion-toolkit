import { memo, useCallback, useMemo } from 'react';

interface TotalsProps {
  prices: number[];
  onSave: () => void;
}

export const useTotals = (prices: number[], onSave: () => void) => {
  const total = useMemo(() => prices.reduce((sum, p) => sum + p, 0), [prices]);
  const handleSave = useCallback(() => onSave(), [onSave]);
  return { total, handleSave };
};

const Totals = ({ prices, onSave }: TotalsProps) => {
  const { total, handleSave } = useTotals(prices, onSave);
  return <button onClick={handleSave}>{total}</button>;
};

export default memo(Totals);
