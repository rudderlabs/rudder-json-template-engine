import { Scenario } from '../../types';

export const data: Scenario[] = [
  {
    templatePath: 'if_block.jt',
    input: {
      a: -5,
    },
    output: 'a <= 1',
  },
  {
    templatePath: 'if_block.jt',
    input: {
      a: 1,
    },
    output: 'a <= 1',
  },
  {
    templatePath: 'if_block.jt',
    input: {
      a: 2,
    },
    output: 'a > 1',
  },
  {
    templatePath: 'if_block.jt',
    input: {
      a: 3,
    },
    output: 'a > 2',
  },
  {
    templatePath: 'if_block.jt',
    input: {
      a: 10,
    },
    output: 'a > 3',
  },
  {
    templatePath: 'if_then.jt',
    input: {
      a: -5,
    },
    output: 0,
  },
  {
    templatePath: 'if_then.jt',
    input: {
      a: 5,
    },
    output: 5,
  },
  {
    templatePath: 'objects.jt',
    input: {
      a: 5,
    },
    output: { message: 'a > 1' },
  },
  {
    templatePath: 'objects.jt',
    input: {
      a: 0,
    },
    output: { message: 'a <= 1' },
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
    templatePath: 'undefined_arr_cond.jt',
    input: {
      products: [{ a: 1 }, { a: 2 }],
    },
    output: 'no',
  },
  {
    templatePath: 'undefined_arr_cond.jt',
    input: {
      products: [{ objectID: 1 }, { objectID: 2 }],
    },
    output: 'yes',
  },
  {
    templatePath: 'undefined_arr_cond.jt',
    input: {
      otherProperty: [{ objectID: 1 }, { objectID: 2 }],
    },
    output: 'no',
  },
];
