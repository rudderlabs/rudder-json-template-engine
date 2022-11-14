export type Dictionary<T> = Record<string, T>;

export enum Keyword {
  FUNCTION = "function",
  NEW = "new",
  TYPEOF = "typeof",
  RETURN = "return",
  LET = "let",
  CONST = "const",
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
  POS_FILTER_EXPR,
  OBJECT_FILTER_EXPR,
  ASSIGNMENT_EXPR,
  LITERAL,
  OBJECT_EXPR,
  ARRAY_EXPR,
  FUNCTION_EXPR,
  FUNCTION_CALL_ARG_EXPR,
  FUNCTION_CALL_EXPR,
  STATEMENTS_EXPR,
  CONDITIONAL_EXPR
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
  params: string[];
  body: StatementsExpression;
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

export interface ObjectPredicateExpression extends Expression {
  arg: Expression;
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
  id: string;
  value: Expression;
  operator?: string;
}

export interface PosFilterExpression extends Expression {
  fromIdx?: Expression;
  toIdx?: Expression;
  idx?: Expression;
  empty?: boolean;
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
}

export interface SelectorExpression extends Expression {
  selector: string;
  prop?: string;
}

export interface FunctionCallArgExpression extends Expression {
  value: Expression;
  spread?: boolean;
}

export interface FunctionCallExpression extends Expression {
  args: FunctionCallArgExpression[];
  id?: string;
  dot?: boolean;
  isNew?: boolean;
}

export interface ConditionalExpression extends Expression {
  args: [Expression, Expression, Expression];
}
