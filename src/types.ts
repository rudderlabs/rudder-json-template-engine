export type Dictionary<T> = Record<string, T>;

export enum Keyword {
  FUNCTION = 'function',
  NEW = 'new',
  TYPEOF = 'typeof',
  RETURN = 'return',
  LET = 'let',
  CONST = 'const',
}

export enum TokenType {
  UNKNOWN,
  ID,
  NUM,
  STR,
  BOOL,
  NULL,
  PUNCT,
  THROW,
  OPERATOR,
  EOT,
}

export enum SyntaxType {
  EMPTY,
  PATH,
  SELECTOR,
  LOGICAL_EXPR,
  COMPARISON_EXPR,
  MATH_EXPR,
  CONCAT_EXPR,
  UNARY_EXPR,
  ARRAY_INDEX_FILTER_EXPR,
  OBJECT_INDEX_FILTER_EXPR,
  RANGE_FILTER_EXPR,
  OBJECT_FILTER_EXPR,
  ASSIGNMENT_EXPR,
  LITERAL,
  OBJECT_EXPR,
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

export interface FunctionExpression extends Expression {
  params?: string[];
  statements: Expression[];
  block?: boolean;
}

export interface ObjectExpression extends Expression {
  props: { key: Expression | string; value: Expression }[];
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
  definition?: string;
}

export interface RangeFilterExpression extends Expression {
  fromIdx?: Expression;
  toIdx?: Expression;
}

export interface IndexFilterExpression extends Expression {
  indexes: Expression[];
  exclude?: boolean;
}

export interface ObjectFilterExpression extends Expression {
  filters: Expression[];
}
export interface LiteralExpression extends Expression {
  value: string | number | boolean | null;
  tokenType: TokenType;
}
export interface PathExpression extends Expression {
  parts: Expression[];
  root?: string;
  block?: boolean;
}

export interface SelectorExpression extends Expression {
  selector: string;
  prop?: Token;
  contextVar?: string;
}
export interface FunctionCallArgExpression extends Expression {
  value: Expression;
  spread?: boolean;
}
export interface FunctionCallExpression extends Expression {
  args: FunctionCallArgExpression[];
  id?: string;
  dot?: boolean;
}
