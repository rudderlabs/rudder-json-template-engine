import { Scenario } from '../../types';

export const data: Scenario[] = [
  {
    templatePath: 'if-then.jt',
    input: {
      a: -5,
    },
    output: 0,
  },
  {
    templatePath: 'if-then.jt',
    input: {
      a: 5,
    },
    output: 5,
  },
  {
    input: {
      a: 5,
      b: 10,
      c: 15,
    },
    output: 15,
  },
  {
    input: {
      a: 15,
      b: 5,
      c: 10,
    },
    output: 15,
  },
  {
    input: {
      a: 10,
      b: 15,
      c: 5,
    },
    output: 15,
  },
  {
    templatePath: 'undefined-arr-cond.jt',
    input: {
      products: [{ a: 1 }, { a: 2 }],
    },
    output: 'no',
  },
  {
    templatePath: 'undefined-arr-cond.jt',
    input: {
      products: [{ objectID: 1 }, { objectID: 2 }],
    },
    output: 'yes',
  },
  {
    templatePath: 'undefined-arr-cond.jt',
    input: {
      otherProperty: [{ objectID: 1 }, { objectID: 2 }],
    },
    output: 'no',
  },
];
