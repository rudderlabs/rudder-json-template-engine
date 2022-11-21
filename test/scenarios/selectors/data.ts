import { Sceanario } from '../../types';

export const data: Sceanario[] = [
  {
    templatePath: 'context_variables.jt',
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
          ],
          id: 1,
        },
        {
          c: [
            {
              id: 3,
            },
            {
              id: 4,
            },
          ],
          id: 2,
        },
      ],
    },
    output: [
      {
        cid: 1,
        cidx: 0,
        bid: 1,
        bidx: 0,
        a: 10,
      },
      {
        cid: 2,
        cidx: 1,
        bid: 1,
        bidx: 0,
        a: 10,
      },
      {
        cid: 3,
        cidx: 0,
        bid: 2,
        bidx: 1,
        a: 10,
      },
      {
        cid: 4,
        cidx: 1,
        bid: 2,
        bidx: 1,
        a: 10,
      },
    ],
  },
  {
    input: {
      a: 10,
      b: 2,
      c: {
        d: 30,
      },
    },
    output: 50,
  },
  {
    templatePath: 'wild_cards.jt',
    input: {
      a: { d: 1 },
      b: [{ d: 2 }, { d: 3 }],
      c: { c: { d: 4 } },
    },
    output: [1, 2, 3, 1, 2, 3, 4],
  },
];
