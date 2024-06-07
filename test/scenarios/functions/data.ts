import { Scenario } from '../../types';

export const data: Scenario[] = [
  {
    templatePath: 'array_functions.jt',
    input: [1, 2, 3, 4],
    output: {
      map: [2, 4, 6, 8],
      filter: [2, 4],
    },
  },
  {
    templatePath: 'function_calls.jt',
    output: ['abc', null, undefined],
  },
  {
    templatePath: 'js_date_function.jt',
    output: ['2022', 8, 19],
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
    templatePath: 'promise.jt',
    input: [1, 2],
    output: [1, 2],
  },
  {
    templatePath: 'promise.jt',
    input: { a: 1 },
    output: { a: 1 },
  },
  {
    output: 80,
  },
];
