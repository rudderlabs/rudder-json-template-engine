import { Sceanario } from '../../types';

export const data: Sceanario[] = [
  {
    templatePath: 'bad_async_usage.jt',
    error: 'Unexpected token',
  },
  {
    templatePath: 'bad_context_var.jt',
    error: 'Unexpected token',
  },
  {
    templatePath: 'bad_function_params.jt',
    error: 'Unexpected token',
  },
  {
    templatePath: 'bad_function_rest_param.jt',
    error: 'Unexpected token',
  },
  {
    templatePath: 'bad_number.jt',
    error: 'Unexpected token',
  },
  {
    templatePath: 'bad_string.jt',
    error: 'Unexpected end of template',
  },
  {
    templatePath: 'empty_object_vars_for_definition.jt',
    error: 'Empty object vars',
  },
  {
    templatePath: 'incomplete_statement.jt',
    error: 'Unexpected end of template',
  },
  {
    templatePath: 'invalid_new_function_call.jt',
    error: 'Unexpected token',
  },
  {
    templatePath: 'invalid_object_vars_for_definition.jt',
    error: 'Invalid object vars',
  },
  {
    templatePath: 'invalid_variable_assignment1.jt',
    error: 'Invalid assignment path',
  },
  {
    templatePath: 'invalid_variable_assignment2.jt',
    error: 'Invalid assignment path',
  },
  {
    templatePath: 'invalid_variable_assignment3.jt',
    error: 'Invalid assignment path',
  },
  {
    templatePath: 'invalid_variable_assignment4.jt',
    error: 'Invalid assignment path',
  },
  {
    templatePath: 'invalid_variable_assignment5.jt',
    error: 'Invalid assignment path',
  },
  {
    templatePath: 'invalid_variable_assignment6.jt',
    error: 'Invalid assignment path',
  },
  {
    templatePath: 'invalid_variable_definition.jt',
    error: 'Invalid normal vars',
  },
  {
    templatePath: 'invalid_token_after_function_def.jt',
    error: 'Unexpected token',
  },
  {
    templatePath: 'object_with_invalid_closing.jt',
    error: 'Unexpected token',
  },
  {
    templatePath: 'object_with_invalid_key.jt',
    error: 'Unexpected token',
  },
  {
    templatePath: 'reserved_id.jt',
    error: 'Reserved ID pattern',
  },
  {
    templatePath: 'unknown_token.jt',
    error: 'Unknown token',
  },
  {
    templatePath: 'unsupported_assignment.jt',
    error: 'Unexpected token',
  },
];

console.log(data[17]);