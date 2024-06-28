import { Scenario } from '../../types';

export const data: Scenario[] = [
  {
    template: '.a.b@b[]',
    description: 'context variable in last part',
    input: {
      a: {
        b: [
          {
            c: 1,
          },
          {
            c: 2,
          },
        ],
      },
    },
    output: [{ c: 1 }, { c: 2 }],
  },
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
    input: {
      orders: [
        {
          id: 1,
          products: [
            {
              name: 'A',
              price: 10,
            },
            {
              name: 'B',
              price: 5,
            },
          ],
        },
        {
          id: 2,
          products: [
            {
              name: 'A',
              price: 10,
            },
            {
              name: 'C',
              price: 15,
            },
          ],
        },
      ],
    },
    output: [
      {
        name: 'A',
        price: 10,
        orderNum: 0,
        orderId: 1,
      },
      {
        name: 'B',
        price: 5,
        orderNum: 0,
        orderId: 1,
      },
      {
        name: 'A',
        price: 10,
        orderNum: 1,
        orderId: 2,
      },
      {
        name: 'C',
        price: 15,
        orderNum: 1,
        orderId: 2,
      },
    ],
  },
];
