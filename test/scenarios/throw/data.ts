import { Scenario } from '../../types';

export const data: Scenario[] = [
  {
    templatePath: 'statement_after_throw.jt',
    error:
      'return, throw, continue and break statements are only allowed as last statements in conditional expressions',
  },
  {
    input: 3,
    error: 'num must be even',
  },
  {
    input: 2,
    output: 1,
  },
  {
    templatePath: 'throw_without_condition.jt',
    error:
      'return, throw, continue and break statements are only allowed as last statements in conditional expressions',
  },
];
