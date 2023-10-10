import { Scenario } from '../../types';

export const data: Scenario[] = [
  {
    templatePath: 'postfix_decrement_on_literal.jt',
    error: 'Invalid postfix increment expression',
  },
  {
    templatePath: 'postfix_decrement_on_non_id.jt',
    error: 'Invalid postfix increment expression',
  },
  {
    templatePath: 'postfix_increment_on_literal.jt',
    error: 'Invalid postfix increment expression',
  },
  {
    templatePath: 'postfix_increment_on_non_id.jt',
    error: 'Invalid postfix increment expression',
  },
  {
    templatePath: 'prefix_decrement_on_literal.jt',
    error: 'Invalid prefix increment expression',
  },
  {
    templatePath: 'prefix_increment_on_literal.jt',
    error: 'Invalid prefix increment expression',
  },
];
