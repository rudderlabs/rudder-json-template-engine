import { Sceanario } from '../../types';

export const data: Sceanario[] = [
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
    bindings: {
      a: 10,
      b: 2,
      c: (a, b) => a * b,
    },
    output: 20,
  },
];
