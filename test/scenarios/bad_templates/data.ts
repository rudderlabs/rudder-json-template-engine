import { Sceanario } from '../../types';

export const data: Sceanario[] = [
  {
    templatePath: 'invalid_variable_assignment.jt',
    error: 'Invalid assignment path',
  },
  {
    templatePath: 'invalid_variable_definition.jt',
    error: 'Invalid normal vars',
  },
  {
    templatePath: 'missing_semi_colon.jt',
    error: 'Unexpected token "let" at',
  },
];
