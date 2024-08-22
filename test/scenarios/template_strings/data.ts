import { Scenario } from '../../types';

export const data: Scenario[] = [
  {
    input: {
      a: 'foo',
    },
    bindings: {
      b: 'bar',
    },
    output: 'Input a=foo, Binding b=bar',
  },
  {
    template: '`unclosed template ${`',
    error: 'Invalid template expression',
  },
  {
    template: '`invalid template expression ${.a + }`',
    error: 'Invalid template expression',
  },
];
