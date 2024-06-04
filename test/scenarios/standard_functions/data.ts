import { Scenario } from '../../types';

export const data: Scenario[] = [
  {
    input: {
      arr: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      obj: {
        foo: 1,
        bar: 2,
        baz: 3,
        quux: 4,
      },
    },
    output: {
      sum: 55,
      sum2: 55,
      avg: 5.5,
      min: 1,
      max: 10,
      stddev: 2.8722813232690143,
      length: 10,
      first: 1,
      last: 10,
      keys: ['foo', 'bar', 'baz', 'quux'],
    },
  },
];
