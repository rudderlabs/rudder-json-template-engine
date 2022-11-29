import { Sceanario } from '../../types';

export const data: Sceanario[] = [
  {
    templatePath: 'filter.jt',
    input: [[{ a: 1 }], [{ a: 2 }, { a: 3 }], [{ a: 4 }, { a: 5 }, { a: 6 }]],
    output: [
      {
        a: [2, 3],
        idx: 0,
      },
      {
        a: [4, 5, 6],
        idx: 1,
      },
    ],
  },
  {
    templatePath: 'function.jt',
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
    templatePath: 'selector.jt',
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
    input: [[{ a: 1 }], [{ a: 2 }, { a: 3 }], [{ a: 4 }, { a: 5 }, { a: 6 }]],
    output: [
      {
        a: 1,
        idx: 0,
      },
      {
        a: [2, 3],
        idx: 1,
      },
      {
        a: [4, 5, 6],
        idx: 2,
        b: [5, 6],
      },
    ],
  },
];
