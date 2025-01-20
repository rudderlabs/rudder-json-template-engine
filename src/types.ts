export enum Keyword {
  FUNCTION = 'function',
  NEW = 'new',
  TYPEOF = 'typeof',
  LET = 'let',
  CONST = 'const',
  LAMBDA = 'lambda',
  AWAIT = 'await',
  ASYNC = 'async',
  IN = 'in',
  NOT_IN = 'nin',
  NOT = 'not',
  CONTAINS = 'contains',
  SUBSETOF = 'subsetof',
  ANYOF = 'anyof',
  NONEOF = 'noneof',
  EMPTY = 'empty',
  SIZE = 'size',
  RETURN = 'return',
  THROW = 'throw',
  CONTINUE = 'continue',
  BREAK = 'break',
  FOR = 'for',
}

export enum TokenType {
  UNKNOWN = 'unknown',
  ID = 'id',
  INT = 'int',
  FLOAT = 'float',
  TEMPLATE = 'template',
  STR = 'str',
  BOOL = 'bool',
  NULL = 'null',
  UNDEFINED = 'undefined',
  LAMBDA_ARG = 'lambda_arg',
  PUNCT = 'punct',
  THROW = 'throw',
  KEYWORD = 'keyword',
  EOT = 'eot',
  REGEXP = 'regexp',
}

// In the order of precedence
export enum OperatorType {
  BASE = 'base',
  CONDITIONAL = 'conditional',
  ASSIGNMENT = 'assignment',
  COALESCING = 'coalescing',
  OR = 'or',
  AND = 'and',
  EQUALITY = 'equality',
  RELATIONAL = 'relational',
  SHIFT = 'shift',
  ADDITION = 'addition',
  MULTIPLICATION = 'multiplication',
  POWER = 'power',
  UNARY = 'unary',
  PREFIX_INCREMENT = 'prefix_increment',
  POSTFIX_INCREMENT = 'postfix_increment',
}

export enum SyntaxType {
  EMPTY = 'empty',
  PATH = 'path',
  PATH_OPTIONS = 'path_options',
  SELECTOR = 'selector',
  LAMBDA_ARG = 'lambda_arg',
  INCREMENT = 'increment',
  LITERAL = 'literal',
  LOGICAL_COALESCE_EXPR = 'logical_coalesce_expr',
  LOGICAL_OR_EXPR = 'logical_or_expr',
  LOGICAL_AND_EXPR = 'logical_and_expr',
  COMPARISON_EXPR = 'comparison_expr',
  IN_EXPR = 'in_expr',
  MATH_EXPR = 'math_expr',
  UNARY_EXPR = 'unary_expr',
  SPREAD_EXPR = 'spread_expr',
  CONDITIONAL_EXPR = 'conditional_expr',
  ARRAY_INDEX_FILTER_EXPR = 'array_index_filter_expr',
  ALL_FILTER_EXPR = 'all_filter_expr',
  OBJECT_INDEX_FILTER_EXPR = 'object_index_filter_expr',
  RANGE_FILTER_EXPR = 'range_filter_expr',
  OBJECT_FILTER_EXPR = 'object_filter_expr',
  ARRAY_FILTER_EXPR = 'array_filter_expr',
  DEFINITION_EXPR = 'definition_expr',
  ASSIGNMENT_EXPR = 'assignment_expr',
  OBJECT_PROP_EXPR = 'object_prop_expr',
  OBJECT_EXPR = 'object_expr',
  ARRAY_EXPR = 'array_expr',
  BLOCK_EXPR = 'block_expr',
  FUNCTION_EXPR = 'function_expr',
  FUNCTION_CALL_EXPR = 'function_call_expr',
  RETURN_EXPR = 'return_expr',
  THROW_EXPR = 'throw_expr',
  STATEMENTS_EXPR = 'statements_expr',
  LOOP_CONTROL_EXPR = 'loop_control_expr',
  LOOP_EXPR = 'loop_expr',
  TEMPLATE_EXPR = 'TEMPLATE_EXPR',
}

export enum PathType {
  SIMPLE = 'simple',
  RICH = 'rich',
  JSON = 'json',
  UNKNOWN = 'unknown',
}

export interface EngineOptions {
  compileTimeBindings?: Record<string, any>;
  defaultPathType?: PathType;
  mappings?: boolean;
}

export type Token = {
  type: TokenType;
  value: any;
  range: [number, number];
};

export interface PathOptions {
  item?: string;
  index?: string;
  toArray?: boolean;
}

export interface Expression {
  type: SyntaxType;
  options?: PathOptions;
  [key: string]: any;
}

export interface PathOptionsExpression extends Expression {
  options: PathOptions;
}

export interface LambdaArgExpression extends Expression {
  index: number;
}

export interface FunctionExpression extends Expression {
  params?: string[];
  body: StatementsExpression;
  block?: boolean;
  async?: boolean;
  lambda?: boolean;
}

export interface BlockExpression extends Expression {
  statements: Expression[];
}

export interface ObjectPropExpression extends Expression {
  key?: Expression | string;
  value: Expression;
  contextVar?: string;
}

export interface ObjectExpression extends Expression {
  props: ObjectPropExpression[];
}

export interface ArrayExpression extends Expression {
  elements: Expression[];
}

export interface StatementsExpression extends Expression {
  statements: Expression[];
}

export interface UnaryExpression extends Expression {
  arg: Expression;
  op: string;
}

export interface BinaryExpression extends Expression {
  args: [Expression, Expression];
  op: string;
}

export interface TemplateExpression extends Expression {
  parts: Expression[];
}

export interface AssignmentExpression extends Expression {
  path: PathExpression;
  value: Expression;
  op: string;
}

export interface DefinitionExpression extends Expression {
  vars: string[];
  fromObject?: boolean;
  value: Expression;
  definition: string;
}

export interface RangeFilterExpression extends Expression {
  fromIdx?: Expression;
  toIdx?: Expression;
}

export interface IndexFilterExpression extends Expression {
  indexes: ArrayExpression;
  exclude?: boolean;
}

export interface AllFilterExpression extends Expression {}

export interface ObjectFilterExpression extends Expression {
  filter: Expression;
}

export interface ArrayFilterExpression extends Expression {
  filter: RangeFilterExpression | IndexFilterExpression;
}

export type Literal = string | number | boolean | null | undefined;
export interface LiteralExpression extends Expression {
  value: Literal;
  tokenType: TokenType;
}

export interface PathExpression extends Expression {
  parts: Expression[];
  root?: Expression | string;
  returnAsArray?: boolean;
  pathType: PathType;
  inferredPathType: PathType;
}

export interface IncrementExpression extends Expression {
  id: string;
  op: string;
  postfix?: boolean;
}

export interface SelectorExpression extends Expression {
  selector: string;
  prop?: Omit<Token, 'range'>;
}
export interface SpreadExpression extends Expression {
  value: Expression;
}

export interface FunctionCallExpression extends Expression {
  args: Expression[];
  object?: Expression;
  id?: string;
  parent?: string;
}

export interface ConditionalExpression extends Expression {
  if: Expression;
  then: Expression;
  else?: Expression;
}

export type BlockExpressionOptions = {
  blockEnd?: string;
  parentType?: SyntaxType;
};

export interface ReturnExpression extends Expression {
  value?: Expression;
}

export interface LoopControlExpression extends Expression {
  control: string;
}
export interface LoopExpression extends Expression {
  init?: Expression;
  test?: Expression;
  update?: Expression;
  body: StatementsExpression;
}

export interface ThrowExpression extends Expression {
  value: Expression;
}

export type FlatMappingPaths = {
  description?: string;
  from?: string;
  to?: string;
  input?: string;
  output?: string;
  [key: string]: any;
};

export type FlatMappingAST = FlatMappingPaths & {
  inputExpr: Expression;
  outputExpr: PathExpression;
};

export type TemplateInput = string | Expression | FlatMappingPaths[] | undefined;
