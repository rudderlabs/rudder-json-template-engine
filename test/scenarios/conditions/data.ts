import { Sceanario } from '../../types';

export const data: Sceanario[] = [
  {
    templatePath: 'if-then.jt',
    input: {
      a: -5
    },
    output: 0
  },
  {
    templatePath: 'if-then.jt',
    input: {
      a: 5
    },
    output: 5
  },
  {
    input: {
      a: 5,
      b: 10,
      c: 15
    },
    output: 15,
  },
  {
    input: {
      a: 15,
      b: 5,
      c: 10
    },
    output: 15,
  },
  {
    input: {
      a: 10,
      b: 15,
      c: 5
    },
    output: 15,
  },
];
