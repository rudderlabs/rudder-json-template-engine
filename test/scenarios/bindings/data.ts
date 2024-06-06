import { Scenario } from '../../types';

class CustomError extends Error {}

export const data: Scenario[] = [
  {
    templatePath: 'async.jt',
    bindings: {
      square: (a) => new Promise((resolve) => setTimeout(() => resolve(a * a), 5)),
      sqrt: (a) => new Promise((resolve) => setTimeout(() => resolve(Math.sqrt(a)), 5)),
    },
    input: [1, 2, 3],
    output: [1, 2, 3],
  },
  {
    templatePath: 'new_operator.jt',
    bindings: { CustomError },
    output: new CustomError('some error'),
  },
  {
    bindings: {
      a: 10,
      b: 2,
      c: (a, b) => a * b,
    },
    output: 20,
  },
];
