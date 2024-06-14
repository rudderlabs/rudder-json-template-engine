import { Scenario } from '../../types';

const input = {
  arr: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  obj: {
    foo: 1,
    bar: 2,
    baz: 3,
    quux: 4,
  },
};

export const data: Scenario[] = [
  {
    template: '.arr.avg()',
    input,
    output: 5.5,
  },
  {
    template: '.arr.first()',
    input,
    output: 1,
  },
  {
    template: '.arr.index(0)',
    input,
    output: 1,
  },
  {
    template: '.arr.index(9)',
    input,
    output: 10,
  },
  {
    template: '.arr.last()',
    input,
    output: 10,
  },
  {
    template: '.arr.length()',
    input,
    output: 10,
  },
  {
    template: '.arr.min()',
    input,
    output: 1,
  },
  {
    template: '.arr.max()',
    input,
    output: 10,
  },
  {
    template: '.arr.stddev()',
    input,
    output: 2.8722813232690143,
  },
  {
    template: '.arr.sum()',
    input,
    output: 55,
  },
  {
    input,
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
