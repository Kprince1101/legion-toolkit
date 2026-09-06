import rule from './no-react-fc.js';
import { runRule } from '../test-utils.js';

runRule('no-react-fc', rule, {
  valid: [
    {
      code: 'interface Props { id: string }\nexport const Row = ({ id }: Props) => <tr>{id}</tr>;',
    },
    { code: 'type Handler = (id: string) => void;' },
    { code: 'const x: Array<string> = [];' },
  ],
  invalid: [
    {
      code: 'import type { FC } from "react";\nexport const Row: FC<{ id: string }> = ({ id }) => <tr>{id}</tr>;',
      errors: [{ messageId: 'noReactFc', data: { name: 'FC' } }],
    },
    {
      code: 'import React from "react";\nexport const Row: React.FC = () => null;',
      errors: [{ messageId: 'noReactFc', data: { name: 'FC' } }],
    },
    {
      code: 'import React from "react";\nexport const Row: React.FunctionComponent<{}> = () => null;',
      errors: [{ messageId: 'noReactFc', data: { name: 'FunctionComponent' } }],
    },
    {
      code: 'import type { VFC } from "react";\nexport const Row: VFC = () => null;',
      errors: [{ messageId: 'noReactFc', data: { name: 'VFC' } }],
    },
  ],
});
