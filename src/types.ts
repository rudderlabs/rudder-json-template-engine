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
  NOT = 'not',
  RETURN = 'return',
  THROW = 'throw',
  CONTINUE = 'continue',
  BREAK = 'break',
  FOR = 'for',
}

export enum TokenType {
  UNKNOWN,
  ID,
  INT,
  FLOAT,
  STR,
  BOOL,
  NULL,
  UNDEFINED,
  LAMBDA_ARG,
  PUNCT,
  THROW,
  KEYWORD,
  EOT,
}

// In the order of precedence

export enum OperatorType {
  BASE,
  CONDITIONAL,
  ASSIGNMENT,
  COALESCING,
  OR,
  AND,
  EQUALITY,
  RELATIONAL,
  SHIFT,
  ADDITION,
  MULTIPLICATION,
  POWER,
  UNARY,
  PREFIX_INCREMENT,
  POSTFIX_INCREMENT,
}

export enum SyntaxType {
  EMPTY,
  PATH,
  PATH_OPTIONS,
  SELECTOR,
  LAMBDA_ARG,
  INCREMENT,
  LITERAL,
  LOGICAL_COALESCE_EXPR,
  LOGICAL_OR_EXPR,
  LOGICAL_AND_EXPR,
  COMPARISON_EXPR,
  IN_EXPR,
  MATH_EXPR,
  UNARY_EXPR,
  SPREAD_EXPR,
  CONDITIONAL_EXPR,
  ARRAY_INDEX_FILTER_EXPR,
  OBJECT_INDEX_FILTER_EXPR,
  RANGE_FILTER_EXPR,
  OBJECT_FILTER_EXPR,
  ARRAY_FILTER_EXPR,
  DEFINITION_EXPR,
  ASSIGNMENT_EXPR,
  OBJECT_PROP_EXPR,
  OBJECT_EXPR,
  ARRAY_EXPR,
  BLOCK_EXPR,
  FUNCTION_EXPR,
  FUNCTION_CALL_ARG,
  FUNCTION_CALL_EXPR,
  RETURN_EXPR,
  THROW_EXPR,
  STATEMENTS_EXPR,
  LOOP_CONTROL_EXPR,
  LOOP_EXPR,
}

export enum PathType {
  SIMPLE,
  RICH,
}

export interface EngineOptions {
  compileTimeBindings?: Record<string, any>;
  defaultPathType?: PathType;
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

export interface LambdaArgExpression extends Expression {
  index: number;
}

export interface FunctionExpression extends Expression {
  params?: string[];
  body: StatementsExpression;
  block?: boolean;
  async?: boolean;
}

export interface BlockExpression extends Expression {
  statements: Expression[];
}

export interface ObjectPropExpression extends Expression {
  key?: Expression | string;
  value: Expression;
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

export interface ConcatExpression extends Expression {
  args: Expression[];
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

export interface ObjectFilterExpression extends Expression {
  filter: Expression;
}

export interface ArrayFilterExpression extends Expression {
  filter: RangeFilterExpression | IndexFilterExpression;
}
export interface LiteralExpression extends Expression {
  value: string | number | boolean | null | undefined;
  tokenType: TokenType;
}
export interface PathExpression extends Expression {
  parts: Expression[];
  root?: Expression | string;
  returnAsArray?: boolean;
  pathType: PathType;
}

export interface IncrementExpression extends Expression {
  id: string;
  op: string;
  postfix?: boolean;
}

export interface SelectorExpression extends Expression {
  selector: string;
  prop?: Token;
}
export interface SpreadExpression extends Expression {
  value: Expression;
}

export interface FunctionCallExpression extends Expression {
  args: Expression[];
  object?: Expression;
  id?: string;
  dot?: boolean;
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
