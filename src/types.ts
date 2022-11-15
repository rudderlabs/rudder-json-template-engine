export type Dictionary<T> = Record<string, T>;

export enum Keyword {
  FUNCTION = 'function',
  NEW = 'new',
  TYPEOF = 'typeof',
  RETURN = 'return',
  LET = 'let',
  CONST = 'const',
  LAMBDA = 'lambda',
}

export enum TokenType {
  UNKNOWN,
  ID,
  NUM,
  STR,
  BOOL,
  NULL,
  UNDEFINED,
  LAMBDA_ARG,
  PUNCT,
  THROW,
  OPERATOR,
  EOT,
}

export enum SyntaxType {
  EMPTY,
  PATH,
  SELECTOR,
  LAMBDA_ARG,
  LITERAL,
  COALESCING_EXPR,
  LOGICAL_OR_EXPR,
  LOGICAL_AND_EXPR,
  COMPARISON_EXPR,
  MATH_EXPR,
  UNARY_EXPR,
  SPREAD_EXPR,
  ARRAY_INDEX_FILTER_EXPR,
  OBJECT_INDEX_FILTER_EXPR,
  RANGE_FILTER_EXPR,
  OBJECT_FILTER_EXPR,
  ARRAY_FILTER_EXPR,
  DEFINTION_EXPR,
  ASSIGNMENT_EXPR,
  OBJECT_PROP_EXPR,
  OBJECT_EXPR,
  TO_ARRAY_EXPR,
  ARRAY_EXPR,
  FUNCTION_EXPR,
  FUNCTION_CALL_ARG,
  FUNCTION_CALL_EXPR,
  STATEMENTS_EXPR,
}

export type Token = {
  type: TokenType;
  value: any;
  range: [number, number];
};

export interface Expression {
  type: SyntaxType;
  [key: string]: any;
}

export interface LambdaArgExpression extends Expression {
  index: number;
}

export interface FunctionExpression extends Expression {
  params?: string[];
  statements: Expression[];
  block?: boolean;
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
export interface FilterExpression extends Expression {
  filters: Expression[];
}
export interface LiteralExpression extends Expression {
  value: string | number | boolean | null;
  tokenType: TokenType;
}
export interface PathExpression extends Expression {
  parts: Expression[];
  root?: Expression | string;
  block?: boolean;
}

export interface ContextVariable {
  item?: string;
  index?: string;
}
export interface SelectorExpression extends Expression {
  selector: string;
  prop?: Token;
  context?: ContextVariable;
}
export interface SpreadExpression extends Expression {
  value: Expression;
}
export interface ToArrayExpression extends Expression {
  value: Expression;
}
export interface FunctionCallExpression extends Expression {
  args: Expression[];
  object?: Expression;
  id?: string;
  dot?: boolean;
}
