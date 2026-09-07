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
      output:
        'import type { FC } from "react";\nexport const Row = ({ id }: { id: string }) => <tr>{id}</tr>;',
      errors: [{ messageId: 'noReactFc', data: { name: 'FC' } }],
    },
    {
      code: 'import React from "react";\nexport const Row: React.FC = () => null;',
      output: 'import React from "react";\nexport const Row = () => null;',
      errors: [{ messageId: 'noReactFc', data: { name: 'FC' } }],
    },
    {
      code: 'import React from "react";\nexport const Row: React.FunctionComponent<{}> = () => null;',
      output: null,
      errors: [{ messageId: 'noReactFc', data: { name: 'FunctionComponent' } }],
    },
    {
      code: 'import type { VFC } from "react";\nexport const Row: VFC = () => null;',
      output:
        'import type { VFC } from "react";\nexport const Row = () => null;',
      errors: [{ messageId: 'noReactFc', data: { name: 'VFC' } }],
    },
  ],
});

runRule('no-react-fc (autofix)', rule, {
  valid: [],
  invalid: [
    {
      code: 'const Card: React.FC<CardProps> = ({ title }) => <h1>{title}</h1>;',
      output: 'const Card = ({ title }: CardProps) => <h1>{title}</h1>;',
      errors: [{ messageId: 'noReactFc' }],
    },
    {
      code: 'const Spacer: FC = () => <div />;',
      output: 'const Spacer = () => <div />;',
      errors: [{ messageId: 'noReactFc' }],
    },
    {
      code: 'const Card: React.FC<CardProps> = ({ t }: CardProps) => <h1>{t}</h1>;',
      output: null,
      errors: [{ messageId: 'noReactFc' }],
    },
    {
      code: 'type Render = React.FC<CardProps>;',
      output: null,
      errors: [{ messageId: 'noReactFc' }],
    },
  ],
});
