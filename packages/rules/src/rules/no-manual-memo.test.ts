import rule from './no-manual-memo.js';
import { runRule } from '../test-utils.js';

runRule('no-manual-memo', rule, {
  valid: [
    {
      code: 'export const useTotals = (items: Item[]) => { const total = items.reduce((sum, i) => sum + i.price, 0); return { total }; };',
    },
    { code: 'export const Row = ({ id }: RowProps) => <tr>{id}</tr>;' },
    {
      code: 'const cache = new Map(); export const memoize = (key: string) => cache.get(key);',
    },
    {
      code: 'export const useThing = () => { const [value, setValue] = useState(0); useEffect(() => { setValue(1); }, []); return value; };',
    },
  ],
  invalid: [
    {
      code: 'export const useTotals = (items: Item[]) => { const total = useMemo(() => items.length, [items]); return { total }; };',
      errors: [{ messageId: 'hook', data: { name: 'useMemo' } }],
    },
    {
      code: 'export const useSave = (onSave: () => void) => { const handleSave = useCallback(() => onSave(), [onSave]); return { handleSave }; };',
      errors: [{ messageId: 'hook', data: { name: 'useCallback' } }],
    },
    {
      code: 'import { memo } from "react";\nconst Row = ({ id }: RowProps) => <tr>{id}</tr>;\nexport default memo(Row);',
      errors: [{ messageId: 'memo' }],
    },
    {
      code: 'import React from "react";\nexport const Row = React.memo(({ id }: RowProps) => <tr>{id}</tr>);',
      errors: [{ messageId: 'memo' }],
    },
    {
      code: 'const v = React.useMemo(() => 1, []);',
      errors: [{ messageId: 'hook', data: { name: 'useMemo' } }],
    },
  ],
});
