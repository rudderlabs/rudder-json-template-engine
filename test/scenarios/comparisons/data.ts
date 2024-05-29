import { Scenario } from '../../types';

export const data: Scenario[] = [
  {
    templatePath: 'anyof.jt',
    output: {
      true: true,
      false: false,
    },
  },
  {
    templatePath: 'contains.jt',
    output: {
      true: [true, true, true],
      false: [false, false, false],
    },
  },
  {
    templatePath: 'empty.jt',
    output: {
      true: [true, true],
      false: [false, false],
    },
  },
  {
    templatePath: 'string_contains_ignore_case.jt',
    output: {
      true: true,
      false: false,
    },
  },
  {
    templatePath: 'ends_with.jt',
    output: {
      true: [true, true],
      false: [false, false],
    },
  },
  {
    templatePath: 'ends_with_ignore_case.jt',
    output: {
      true: [true, true],
      false: [false, false],
    },
  },
  {
    templatePath: 'eq.jt',
    output: {
      true: true,
      false: false,
    },
  },
  {
    templatePath: 'ge.jt',
    output: {
      true: true,
      false: false,
    },
  },
  {
    templatePath: 'gte.jt',
    output: {
      true: true,
      false: false,
    },
  },
  {
    templatePath: 'in.jt',
    output: {
      true: [true, true],
      false: [false, false],
    },
  },
  {
    templatePath: 'le.jt',
    output: {
      true: true,
      false: false,
    },
  },
  {
    templatePath: 'lte.jt',
    output: {
      true: true,
      false: false,
    },
  },
  {
    templatePath: 'ne.jt',
    output: {
      true: true,
      false: false,
    },
  },
  {
    templatePath: 'noneof.jt',
    output: {
      true: true,
      false: false,
    },
  },
  {
    templatePath: 'not_in.jt',
    output: {
      true: [true, true],
      false: [false, false],
    },
  },
  {
    templatePath: 'regex.jt',
    output: {
      true: [true, true],
      false: [false, false],
    },
  },
  {
    templatePath: 'size.jt',
    output: {
      true: [true, true],
      false: [false, false],
    },
  },
  {
    templatePath: 'starts_with.jt',
    output: {
      true: [true, true],
      false: [false, false],
    },
  },
  {
    templatePath: 'starts_with_ignore_case.jt',
    output: {
      true: [true, true],
      false: [false, false],
    },
  },
  {
    templatePath: 'string_eq.jt',
    output: {
      true: true,
      false: false,
    },
  },
  {
    templatePath: 'string_ne.jt',
    output: {
      true: true,
      false: false,
    },
  },
  {
    templatePath: 'string_eq_ingore_case.jt',
    output: {
      true: true,
      false: false,
    },
  },
  {
    templatePath: 'string_ne.jt',
    output: {
      true: true,
      false: false,
    },
  },
  {
    templatePath: 'string_ne_ingore_case.jt',
    output: {
      true: true,
      false: false,
    },
  },
  {
    templatePath: 'subsetof.jt',
    output: {
      true: [true, true],
      false: [false, false],
    },
  },
];
