import { Scenario } from '../../types';

export const data: Scenario[] = [
  {
    templatePath: 'break_without_condition.jt',
    error:
      'return, throw, continue and break statements are only allowed as last statements in conditional expressions',
  },
  {
    templatePath: 'break_without_loop.jt',
    error: 'encounted loop control outside loop',
  },
  {
    templatePath: 'complex_loop.jt',
    output: 10,
  },
  {
    templatePath: 'continue_without_condition.jt',
    error:
      'return, throw, continue and break statements are only allowed as last statements in conditional expressions',
  },
  {
    templatePath: 'continue_without_loop.jt',
    error: 'encounted loop control outside loop',
  },
  {
    templatePath: 'continue.jt',
    input: {
      num: 10,
    },
    output: 25,
  },
  {
    templatePath: 'empty_loop.jt',
    error: 'Empty statements are not allowed in loop and condtional expressions',
  },
  {
    templatePath: 'just_for.jt',
    input: {
      num: 10,
    },
    output: 55,
  },
  {
    input: {
      num: 10,
    },
    output: 55,
    templatePath: 'no_init.jt',
  },
  {
    input: {
      num: 10,
    },
    output: 55,
    templatePath: 'no_test.jt',
  },
  {
    input: {
      num: 10,
    },
    output: 55,
    templatePath: 'no_update.jt',
  },
  {
    templatePath: 'statement_after_break.jt',
    error:
      'return, throw, continue and break statements are only allowed as last statements in conditional expressions',
  },
  {
    templatePath: 'statement_after_continue.jt',
    error:
      'return, throw, continue and break statements are only allowed as last statements in conditional expressions',
  },
  {
    input: {
      num: 10,
    },
    output: 55,
  },
];
