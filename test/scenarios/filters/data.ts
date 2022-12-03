import { Scenario } from '../../types';

export const data: Scenario[] = [
  {
    templatePath: 'array_filters.jt',
    output: [
      [
        3,
        4,
        5,
        {
          a: 1,
          b: 2,
          c: 3,
        },
      ],
      [1, 2, 3],
      [4, 5],
      [2, 4],
      5,
      2,
      [1, 2, 3, 4],
      [
        5,
        {
          a: 1,
          b: 2,
          c: 3,
        },
      ],
      [1, 2],
    ],
  },
  {
    templatePath: 'object_filters.jt',
    output: {
      a: [3, 4],
      b: 2,
    },
  },
  {
    templatePath: 'object_indexes.jt',
    output: {
      a: 1,
      b: 2,
      c: 3,
      d: 4,
    },
  },
];
