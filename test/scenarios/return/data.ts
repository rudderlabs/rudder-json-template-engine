import { Scenario } from '../../types';

export const data: Scenario[] = [
  {
    templatePath: 'return_without_condition.jt',
    error:
      'return, throw, continue and break statements are only allowed as last statements in conditional expressions',
  },
  {
    templatePath: 'statement_after_return.jt',
    error:
      'return, throw, continue and break statements are only allowed as last statements in conditional expressions',
  },
  {
    templatePath: 'return_no_value.jt',
    input: 2,
  },
  {
    templatePath: 'return_value.jt',
    input: 3,
    output: 1,
  },
  {
    templatePath: 'return_value.jt',
    input: 2,
    output: 1,
  },
];
