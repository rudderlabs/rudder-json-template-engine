export type Dictionary<T> = Record<string, T>;

export enum TokenType {
  UNKNOWN,
  ID,
  NUM,
  STR,
  BOOL,
  NULL,
  PUNCT,
  ASSIGNMENT,
  FUNCTIION,
  FUNCTION_CALL,
  EOT,
}

export enum SyntaxType {
  EMPTY,
  PATH,
  SELECTOR,
  OBJ_PRED,
  LOGICAL_EXPR,
  COMPARISON_EXPR,
  MATH_EXPR,
  CONCAT_EXPR,
  UNARY_EXPR,
  POS_EXPR,
  ASSIGNMENT_EXPR,
  LITERAL,
  OBJECT_EXPR,
  ARRAY_EXPR,
  FUNCTION_EXPR,
  FUNCTION_CALL_EXPR,
  STATEMENTS_EXPR,
}

export type Token = {
  type: TokenType;
  value?: any;
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
  props: Dictionary<Expression>;
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
}

export interface PosExpression extends Expression {
  fromIdx?: Expression;
  toIdx?: Expression;
  idx?: Expression;
}
export interface LiteralExpression extends Expression {
  value: string | number | boolean | null;
}

export interface PathExpression extends Expression {
  parts: Expression[];
  root?: string;
}

export interface SelectorExpression extends Expression {
  selector: string;
  prop?: string;
}

export interface FunctionCallExpression extends Expression {
  args: Expression[];
  id: string;
}
