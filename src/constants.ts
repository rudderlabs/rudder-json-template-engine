import { SyntaxType } from './types';

export const VARS_PREFIX = '___';
export const DATA_PARAM_KEY = '___d';
export const BINDINGS_PARAM_KEY = '___b';
export const BINDINGS_CONTEXT_KEY = '___b.context.';
export const RESULT_KEY = '___r';
export const FUNCTION_RESULT_KEY = '___f';
export const INDENTATION_SPACES = 4;
export const EMPTY_EXPR = { type: SyntaxType.EMPTY };
