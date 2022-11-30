import { Sceanario } from '../../types';

export const data: Sceanario[] = [
  {
    input: [
      {
        a: { e: 1 },
        b: [{ e: 2 }, { e: [3, 2] }],
        c: { c: { e: 4 } },
        d: [
          [1, 2],
          [3, 4],
        ],
      },
    ],
    output: [
      [3],
      'aa',
      {
        e: 1,
      },
      4,
      3,
      4,
      1,
    ],
  },
];
