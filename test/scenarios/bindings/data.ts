import { Sceanario } from '../../types';

export const data: Sceanario[] = [
  {
    bindings: {
      a: 10,
      b: 2,
      c: (a, b) => a * b,
    },
    output: 20,
  },
];
