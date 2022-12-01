import { Sceanario } from '../../types';

export const data: Sceanario[] = [
  {
    templatePath: 'function_calls.jt',
    output: ['abc', undefined, undefined],
  },
  {
    templatePath: 'js_date_function.jt',
    output: [2022, 8, 19],
  },
  {
    templatePath: 'new_operator.jt',
    output: [
      {
        name: 'foo',
        grade: 1,
      },
      {
        name: 'bar',
        grade: 2,
      },
    ],
  },
  {
    templatePath: 'parent_scope_vars.jt',
    output: 90,
  },
  {
    output: 80,
  },
];
