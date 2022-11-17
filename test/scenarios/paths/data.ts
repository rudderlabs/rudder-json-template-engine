import { Sceanario } from '../../types';

export const data: Sceanario[] = [
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
