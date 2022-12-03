import { Scenario } from '../../types';

export const data: Scenario[] = [
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
    output: [
      [1, 2, 3],
      [1, 2, 3, 4],
    ],
  },
];
