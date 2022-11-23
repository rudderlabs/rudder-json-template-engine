import { Sceanario } from '../../types';

export const data: Sceanario[] = [
  {
    templatePath: 'block.jt',
    input: {
      a: [
        {
          b: [1, 2],
        },
        {
          b: [1, 2],
        },
      ],
    },
    output: [1, 2, 2, 3],
  },
  {
    input: {
      a: { d: 1 },
      b: [{ d: 2 }, { d: 3 }],
      c: { c: { d: 4 } },
    },
    output: [
      [3],
      'aa',
      {
        d: 1,
      },
      4,
      3,
    ],
  },
];
