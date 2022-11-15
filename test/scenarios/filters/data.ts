import { Sceanario } from '../../types';

export const data: Sceanario[] = [
  {
    input: {
      a: 10,
      b: [
        {
          c: [
            {
              id: 1,
            },
            {
              id: 2,
            },
            {
              id: 3,
            },
          ],
          id: 1,
        },
        {
          c: [
            {
              id: 4,
            },
            {
              id: 5,
            },
            {
              id: 6,
            },
            {
              id: 7,
            },
          ],
          id: 2,
        },
      ],
    },
    output: [
      {
        bid: 1,
        cid: 1,
      },
      {
        bid: 1,
        cid: 3,
      },
    ],
  },
];
