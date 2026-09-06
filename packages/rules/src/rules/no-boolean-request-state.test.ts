import rule from './no-boolean-request-state.js';
import { runRule } from '../test-utils.js';

runRule('no-boolean-request-state', rule, {
  valid: [
    {
      code: 'export const useSave = () => { const [request, setRequest] = useState<RequestState>({ status: "idle" }); return { request }; };',
    },
    {
      code: 'export const useSave = () => { const [isLoading, setIsLoading] = useState(false); const [items, setItems] = useState([]); return { isLoading, items }; };',
    },
    {
      code: 'export const useA = () => { const [loading] = useState(false); return loading; };\nexport const useB = () => { const [error] = useState(null); return error; };',
    },
  ],
  invalid: [
    {
      code: 'export const useSave = () => { const [isLoading, setIsLoading] = useState(false); const [error, setError] = useState<string | null>(null); return { isLoading, error }; };',
      errors: [
        {
          messageId: 'booleans',
          data: {
            name: 'error',
            count: '2nd',
            owner: 'useSave',
            others: '`isLoading`',
          },
        },
      ],
    },
    {
      code: 'export const useSave = () => { const [loading] = useState(false); const [error] = useState(null); const [success] = useState(false); return { loading, error, success }; };',
      errors: [
        {
          messageId: 'booleans',
          data: {
            name: 'error',
            count: '2nd',
            owner: 'useSave',
            others: '`loading`',
          },
        },
        {
          messageId: 'booleans',
          data: {
            name: 'success',
            count: '3rd',
            owner: 'useSave',
            others: '`loading`, `error`',
          },
        },
      ],
    },
    {
      code: 'export const Form = () => { const [submitting, setSubmitting] = useState(false); const [failed, setFailed] = useState(false); return <form />; };',
      errors: [
        {
          messageId: 'booleans',
          data: {
            name: 'failed',
            count: '2nd',
            owner: 'Form',
            others: '`submitting`',
          },
        },
      ],
    },
  ],
});
