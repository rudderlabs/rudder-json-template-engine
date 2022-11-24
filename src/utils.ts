import { Expression, StatementsExpression, SyntaxType } from './types';

export class CommonUtils {
  static toArray(val: any): any[] | undefined {
    if (val === undefined || val === null) {
      return undefined;
    }
    return Array.isArray(val) ? val : [val];
  }

  static getLastElement<T>(arr: T[]): T | undefined {
    return arr[arr.length - 1];
  }

  static convertToStatementsExpr(...expressions: Expression[]): StatementsExpression {
    return {
      type: SyntaxType.STATEMENTS_EXPR,
      statements: expressions,
    };
  }

  static CreateAsyncFunction(...args) {
    return async function () {}.constructor(...args);
  }

  static escapeStr(s?: string): string {
    if (typeof s !== 'string') {
      return '';
    }
    return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  }
}
