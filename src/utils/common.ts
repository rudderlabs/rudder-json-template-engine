import {
  type Expression,
  type StatementsExpression,
  SyntaxType,
  BlockExpression,
  FlatMappingPaths,
} from '../types';

export function toArray<T>(val: T | T[] | undefined): T[] | undefined {
  if (val === undefined || val === null) {
    return undefined;
  }
  return Array.isArray(val) ? val : [val];
}

export function getLastElement<T>(arr: T[]): T | undefined {
  if (!arr.length) {
    return undefined;
  }
  return arr[arr.length - 1];
}

export function createBlockExpression(expr: Expression): BlockExpression {
  return {
    type: SyntaxType.BLOCK_EXPR,
    statements: [expr],
  };
}

export function convertToStatementsExpr(...expressions: Expression[]): StatementsExpression {
  return {
    type: SyntaxType.STATEMENTS_EXPR,
    statements: expressions,
  };
}

export function CreateAsyncFunction(...args) {
  // eslint-disable-next-line @typescript-eslint/no-empty-function, func-names
  return async function () {}.constructor(...args);
}

export function isExpression(val: string | Expression | FlatMappingPaths[]): boolean {
  return (
    typeof val === 'object' && !Array.isArray(val) && Object.values(SyntaxType).includes(val.type)
  );
}

export function escapeStr(s?: string): string {
  if (typeof s !== 'string') {
    return '';
  }
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}
