import { DATA_PARAM_KEY, RESULT_KEY, VARS_PREFIX } from './constants';
import { binaryOperators } from './operators';
import {
  ArrayExpression,
  AssignmentExpression,
  BinaryExpression,
  ConcatExpression,
  Expression,
  FunctionCallExpression,
  FunctionExpression,
  LiteralExpression,
  ObjectFilterExpression,
  ObjectExpression,
  PathExpression,
  RangeFilterExpression,
  SelectorExpression,
  StatementsExpression,
  SyntaxType,
  UnaryExpression,
  Keyword,
  TokenType,
  IndexFilterExpression,
} from './types';

export class JsonTemplateTranslator {
  private body: string[];
  private vars: string[];
  private lastVarId: number;
  private unusedVars: string[];
  private expr: Expression;
  private code?: string;

  constructor(expr: Expression) {
    this.body = [];
    this.vars = [];
    this.lastVarId = 0;
    this.unusedVars = [];
    this.expr = expr;
  }

  private acquireVar(): string {
    if (this.unusedVars.length) {
      return this.unusedVars.shift() as string;
    }

    const varName = `${VARS_PREFIX}${++this.lastVarId}`;
    this.vars.push(varName);
    return varName;
  }

  private releaseVars(...args: any[]) {
    let i = args.length;
    while (i--) {
      this.unusedVars.push(args[i]);
    }
  }

  translate(): string {
    if (!this.code) {
      this.translateExpr(this.expr, RESULT_KEY, DATA_PARAM_KEY);

      this.body.unshift(
        '"use strict";',
        'const concat = Array.prototype.concat;',
        `let ${RESULT_KEY} = undefined;`,
        this.vars.map((elm) => `let ${elm};`).join(''),
      );

      this.body.push(`return ${RESULT_KEY};`);

      this.code = this.body.join('');
    }
    return this.code;
  }

  private translateExpr(expr: Expression, dest: string, ctx: string) {
    switch (expr.type) {
      case SyntaxType.STATEMENTS_EXPR:
        this.translateStatementsExpr(expr as StatementsExpression, dest, ctx);
        break;
      case SyntaxType.PATH:
        this.translatePath(expr as PathExpression, dest, ctx);
        break;

      case SyntaxType.CONCAT_EXPR:
        this.translateConcatExpr(expr as ConcatExpression, dest, ctx);
        break;

      case SyntaxType.COMPARISON_EXPR:
        this.translateComparisonExpr(expr as BinaryExpression, dest, ctx);
        break;

      case SyntaxType.MATH_EXPR:
        this.translateMathExpr(expr as BinaryExpression, dest, ctx);
        break;

      case SyntaxType.LOGICAL_EXPR:
        this.translateLogicalExpr(expr as BinaryExpression, dest, ctx);
        break;

      case SyntaxType.UNARY_EXPR:
        this.translateUnaryExpr(expr as UnaryExpression, dest, ctx);
        break;

      case SyntaxType.LITERAL:
        this.translateLiteralExpr(expr as LiteralExpression, dest, ctx);
        break;

      case SyntaxType.ARRAY_EXPR:
        this.translateArrayExpr(expr as ArrayExpression, dest, ctx);
        break;

      case SyntaxType.OBJECT_EXPR:
        this.translateObjectExpr(expr as ObjectExpression, dest, ctx);
        break;

      case SyntaxType.FUNCTION_EXPR:
        this.translateFunctionExpr(expr as FunctionExpression, dest, ctx);
        break;

      case SyntaxType.FUNCTION_CALL_EXPR:
        this.translateFunctionCallExpr(expr as FunctionCallExpression, dest, ctx);
        break;

      case SyntaxType.ASSIGNMENT_EXPR:
        this.translateAssignmentExpr(expr as AssignmentExpression, dest, ctx);
        break;

      case SyntaxType.OBJECT_FILTER_EXPR:
        this.translateObjectFilterExpr(expr as ObjectFilterExpression, dest, dest);
        break;

      case SyntaxType.RANGE_FILTER_EXPR:
        this.translateRangeFilterExpr(expr as RangeFilterExpression, dest, dest);
        break;

      case SyntaxType.ARRAY_INDEX_FILTER_EXPR:
        this.translateArrayIndexFilterExpr(expr as IndexFilterExpression, dest, dest);
        break;

      case SyntaxType.OBJECT_INDEX_FILTER_EXPR:
        this.translateObjectIndexFilterExpr(expr as IndexFilterExpression, dest, dest);
        break;

      case SyntaxType.SELECTOR:
        this.translateSelector(expr as SelectorExpression, dest, dest);
        break;
    }
  }

  private combinePathParts(parts: Expression[]): Expression[] {
    const newParts: Expression[] = [];
    for (let i = 0; i < parts.length; i++) {
      let expr = parts[i];
      if (parts[i].type === SyntaxType.SELECTOR) {
        const selectorExpr = parts[i] as SelectorExpression;
        if (
          selectorExpr.selector === '.' &&
          selectorExpr.prop?.type === TokenType.ID &&
          parts[i + 1]?.type === SyntaxType.FUNCTION_CALL_EXPR
        ) {
          expr = parts[i + 1] as FunctionCallExpression;
          expr.id = selectorExpr.prop.value;
          expr.dot = true;
          i++;
        }
      }
      newParts.push(expr);
    }
    return newParts;
  }

  private pathContainsVariables(expr: PathExpression): boolean {
    return expr.parts
      .filter((part) => part.type === SyntaxType.SELECTOR)
      .map((part) => part as SelectorExpression)
      .some((part) => part.contextVar || part.posVar);
  }

  private translateAsBlockExpr(expr: Expression, dest: string, ctx: string) {
    const blockExpr: FunctionExpression = {
      type: SyntaxType.FUNCTION_EXPR,
      block: true,
      statements: [expr],
    };
    this.translateFunctionExpr(blockExpr, dest, ctx);
  }

  private translatePath(expr: PathExpression, dest: string, ctx: string) {
    if (!expr.block && this.pathContainsVariables(expr)) {
      expr.block = true;
      return this.translateAsBlockExpr(expr, dest, ctx);
    }
    const parts = this.combinePathParts(expr.parts);
    let newCtx = expr.root || ctx;
    this.body.push(dest, '=', newCtx, ';');

    parts.forEach((part) => {
      this.translateExpr(part, dest, dest);
    });
  }

  private translateDescendantSelector(expr: SelectorExpression, dest: string, baseCtx: string) {
    const { prop } = expr;
    const ctx = this.acquireVar();
    const curCtx = this.acquireVar();
    const childCtxs = this.acquireVar();
    const i = this.acquireVar();
    const j = this.acquireVar();
    const val = this.acquireVar();
    const len = this.acquireVar();
    const result = this.acquireVar();
    this.body.push(JsonTemplateTranslator.covertToArrayValue(dest));
    this.body.push(
      ctx,
      '=',
      baseCtx,
      '.slice(),',
      result,
      '=[];',
      'while(',
      ctx,
      '.length) {',
      curCtx,
      '=',
      ctx,
      '.shift();',
    );
    prop
      ? this.body.push('if(typeof ', curCtx, '=== "object" &&', curCtx, ') {')
      : this.body.push('if(typeof ', curCtx, '!= null) {');
    this.body.push(
      childCtxs,
      '= [];',
      'if(Array.isArray(',
      curCtx,
      ')) {',
      i,
      '= 0,',
      len,
      '=',
      curCtx,
      '.length;',
      'while(',
      i,
      '<',
      len,
      ') {',
      val,
      '=',
      curCtx,
      '[',
      i,
      '++];',
    );
    prop && this.body.push('if(typeof ', val, '=== "object") {');
    this.inlineAppendToArray(childCtxs, val);
    prop && this.body.push('}');
    this.body.push('}', '}', 'else {');
    if (prop) {
      if (prop.value !== '*') {
        const propStr = JsonTemplateTranslator.escapeStr(prop.value);
        this.body.push(val, '=', curCtx, `[${propStr}];`);
        this.inlineAppendToArray(result, val);
      }
    } else {
      this.inlineAppendToArray(result, curCtx);
      this.body.push('if(typeof ', curCtx, '=== "object") {');
    }

    this.body.push(
      'for(',
      j,
      ' in ',
      curCtx,
      ') {',
      'if(',
      curCtx,
      '.hasOwnProperty(',
      j,
      ')) {',
      val,
      '=',
      curCtx,
      '[',
      j,
      '];',
    );
    this.inlineAppendToArray(childCtxs, val);
    prop?.value === '*' && this.inlineAppendToArray(result, val);
    this.body.push('}', '}');
    prop?.value || this.body.push('}');
    this.body.push(
      '}',
      childCtxs,
      '.length &&',
      ctx,
      '.unshift.apply(',
      ctx,
      ',',
      childCtxs,
      ');',
      '}',
      '}',
      dest,
      '=',
      result,
      ';',
    );

    this.releaseVars(ctx, curCtx, childCtxs, i, j, val, len, result);
  }

  private translateConcatExpr(expr: ConcatExpression, dest: string, ctx: string) {
    const argVars: any[] = [];
    const { args } = expr;
    const len = args.length;
    let i = 0;

    while (i < len) {
      argVars.push(this.acquireVar());
      this.translateExpr(args[i], argVars[i++], ctx);
    }

    this.body.push(JsonTemplateTranslator.covertToArrayValue(dest));
    this.body.push(dest, '= concat.call(', argVars.join(','), ');');

    this.releaseVars(argVars);
  }

  private translateFunctionExpr(expr: FunctionExpression, dest: string, ctx: string) {
    this.body.push(dest, '= function(', (expr.params || []).join(','), '){');
    const returnVal = this.acquireVar();
    this.body.push(`let ${returnVal} = undefined;`);
    this.translateStatements(expr.statements, returnVal, ctx);
    this.body.push('return ', returnVal, ';}');
    if (expr.block) {
      this.body.push('()');
    }
    this.body.push(';');
    this.releaseVars(returnVal);
  }

  private getFunctionName(expr: FunctionCallExpression, dest: string) {
    return expr.dot ? `${dest}.${expr.id}` : expr.id || dest;
  }

  private translateFunctionCallExpr(expr: FunctionCallExpression, dest: string, ctx: string) {
    const vars: string[] = [];
    const functionArgs: string[] = [];
    for (let arg of expr.args) {
      const varName = this.acquireVar();
      this.translateExpr(arg.value, varName, ctx);
      vars.push(varName);
      functionArgs.push(arg.spread ? `...${varName}` : varName);
    }

    this.body.push(dest, '=', this.getFunctionName(expr, dest), '(', functionArgs.join(','), ');');
    this.releaseVars(...vars);
  }

  private translateObjectExpr(expr: ObjectExpression, dest: string, ctx: string) {
    const propExprs: string[] = [];
    const vars: string[] = [];
    for (let prop of expr.props) {
      const valueVar = this.acquireVar();
      let key = prop.key;
      if (typeof prop.key !== 'string') {
        const keyVar = this.acquireVar();
        this.translateExpr(prop.key, keyVar, ctx);
        key = `[${keyVar}]`;
        vars.push(keyVar);
      }
      this.translateExpr(prop.value, valueVar, ctx);
      propExprs.push(`${key}:${valueVar}`);
      vars.push(valueVar);
    }
    this.body.push(dest, '={', propExprs.join(','), '};');
    this.releaseVars(...vars);
  }

  private translateArrayExpr(expr: ArrayExpression, dest: string, ctx: string) {
    const vars = expr.elements.map((arg) => {
      const varName = this.acquireVar();
      this.translateExpr(arg, varName, ctx);
      return varName;
    });
    this.body.push(dest, '=[', vars.join(','), '];');
    this.releaseVars(...vars);
  }

  private translateLiteralExpr(expr: LiteralExpression, dest: string, _ctx: string) {
    this.body.push(dest, '=');
    this.translateLiteral(expr.value);
    this.body.push(';');
  }

  private translateAssignmentExpr(expr: AssignmentExpression, dest: string, ctx: string) {
    const varName = this.acquireVar();
    this.translateExpr(expr.value, varName, ctx);
    this.body.push(`${expr.definition || ''} ${expr.id}=${varName};`);
    this.body.push(`${dest} = ${expr.id};`);
    this.releaseVars(varName);
  }

  private translateStatementsExpr(expr: StatementsExpression, dest: string, ctx: string) {
    this.translateStatements(expr.statements, dest, ctx);
  }

  private translateStatements(statements: Expression[], dest: string, ctx: string) {
    for (let statement of statements) {
      this.translateExpr(statement, dest, ctx);
    }
  }

  private translateComparisonExpr(expr: BinaryExpression, dest: string, ctx: string) {
    const val1 = this.acquireVar();
    const val2 = this.acquireVar();
    const isVal1Array = this.acquireVar();
    const isVal2Array = this.acquireVar();
    const i = this.acquireVar();
    const j = this.acquireVar();
    const len1 = this.acquireVar();
    const len2 = this.acquireVar();
    const leftArg = expr.args[0];
    const rightArg = expr.args[1];

    this.body.push(dest, '= false;');

    this.translateExpr(leftArg, val1, ctx);
    this.translateExpr(rightArg, val2, ctx);

    this.body.push(`${isVal1Array}=Array.isArray(${val1});`);
    this.body.push(`${isVal2Array}=Array.isArray(${val2});`);

    this.body.push(`if(${isVal1Array} && ${val1}.length === 1) {`);
    this.body.push(`${val1}=${val1}[0]; ${isVal1Array}=false;}`);
    this.body.push(`if(${isVal2Array} && ${val2}.length === 1) {`);
    this.body.push(`${val2}=${val2}[0]; ${isVal2Array}=false;}`);

    this.body.push(`${i}=0;if(${isVal1Array}){${len1}=${val1}.length;`);
    this.body.push(`if(${isVal2Array}){${len2}=${val2}.length;`);

    this.body.push(
      'while(',
      i,
      '<',
      len1,
      '&& !',
      dest,
      ') {',
      j,
      '= 0;',
      'while(',
      j,
      '<',
      len2,
      ') {',
    );
    this.writeCondition(expr.op, [val1, '[', i, ']'].join(''), [val2, '[', j, ']'].join(''));
    this.body.push(
      dest,
      '= true;',
      'break;',
      '}',
      '++',
      j,
      ';',
      '}',
      '++',
      i,
      ';',
      '}',
      '}',
      'else {',
    );

    this.body.push('while(', i, '<', len1, ') {');
    this.writeCondition(expr.op, [val1, '[', i, ']'].join(''), val2);
    this.body.push(dest, '= true;', 'break;', '}', '++', i, ';', '}');

    this.body.push('}');

    this.body.push('}');

    this.body.push(
      'else if(',
      isVal2Array,
      ') {',
      len2,
      '=',
      val2,
      '.length;',
      'while(',
      i,
      '<',
      len2,
      ') {',
    );
    this.writeCondition(expr.op, val1, [val2, '[', i, ']'].join(''));
    this.body.push(dest, '= true;', 'break;', '}', '++', i, ';', '}', '}');

    this.body.push('else {', dest, '=', binaryOperators[expr.op](val1, val2), ';', '}');

    this.releaseVars(val1, val2, isVal1Array, isVal2Array, i, j, len1, len2);
  }

  private inlineAppendToArray(result, val, tmpArr?, len?) {
    this.body.push(`
      if(${val} !== undefined) {
        if(Array.isArray(${val})) {
    `);
    if (tmpArr) {
      this.body.push(len, '> 1?');
      this.inlinePushToArray(tmpArr, val);
      this.body.push(':');
    }
    this.body.push(
      `${result} = ${result}.length ? ${result}.concat(${val}) : ${val}.slice();
      } else {`,
    );
    tmpArr &&
      this.body.push(
        `if(${tmpArr}.length) {
          ${result} = ${result}.concat(tmpArr);
          ${tmpArr} = [];
        }`,
      );
    this.inlinePushToArray(result, val);
    this.body.push(';', '}', '}');
  }

  private inlinePushToArray(result, val) {
    this.body.push(result, '.length?', result, '.push(', val, ') :', result, '[0] =', val);
  }

  private translateLiteral(val) {
    this.body.push(
      typeof val === 'string' ? JsonTemplateTranslator.escapeStr(val) : val === null ? 'null' : val,
    );
  }

  private translateSelector(expr: SelectorExpression, dest: string, ctx: string) {
    if (expr.selector === '...') {
      return this.translateDescendantSelector(expr, dest, dest);
    }

    if (expr.prop) {
      const prop = expr.prop.value;
      const propStr = JsonTemplateTranslator.escapeStr(prop);
      this.body.push(`
        if (${ctx}[${propStr}] !== undefined && !Array.isArray(${ctx}[${propStr}])) {
          ${dest} = ${ctx}[${propStr}];
        } else {
      `);
      const result = this.acquireVar();
      const i = this.acquireVar();
      const len = this.acquireVar();
      const curCtx = this.acquireVar();
      const j = this.acquireVar();
      const val = this.acquireVar();
      const tmpArr = this.acquireVar();

      this.body.push(JsonTemplateTranslator.covertToArrayValue(dest));

      this.body.push(
        result,
        '= [];',
        i,
        '= 0;',
        len,
        '=',
        ctx,
        '.length;',
        tmpArr,
        '= [];',
        'while(',
        i,
        '<',
        len,
        ') {',
        curCtx,
        '=',
        ctx,
        '[',
        i,
        '++];',
        'if(',
        curCtx,
        '!= null) {',
      );
      if (prop === '*') {
        this.body.push(
          'if(typeof ',
          curCtx,
          '=== "object") {',
          'if(Array.isArray(',
          curCtx,
          ')) {',
          result,
          '=',
          result,
          '.concat(',
          curCtx,
          ');',
          '}',
          'else {',
          'for(',
          j,
          ' in ',
          curCtx,
          ') {',
          'if(',
          curCtx,
          '.hasOwnProperty(',
          j,
          ')) {',
          val,
          '=',
          curCtx,
          '[',
          j,
          '];',
        );
        this.inlineAppendToArray(result, val);
        this.body.push('}', '}', '}', '}');
      } else {
        this.body.push(val, '=', curCtx, '[', propStr, '];');
        this.inlineAppendToArray(result, val, tmpArr, len);
      }
      this.body.push(
        '}',
        '}',
        dest,
        '=',
        len,
        '> 1 &&',
        tmpArr,
        '.length?',
        tmpArr,
        '.length > 1?',
        'concat.apply(',
        result,
        ',',
        tmpArr,
        ') :',
        result,
        '.concat(',
        tmpArr,
        '[0]) :',
        result,
        ';',
      );
      this.body.push('}');

      if (expr.contextVar) {
        this.body.push(`let ${expr.contextVar} = ${dest};`);
      }
      this.releaseVars(result, i, len, curCtx, j, val, tmpArr);
    }
  }

  private translateUnaryExpr(expr: UnaryExpression, dest: string, ctx: string) {
    const val = this.acquireVar();
    const { arg } = expr;

    this.translateExpr(arg, val, ctx);

    switch (expr.op) {
      case '!':
        this.body.push(dest, '= !', JsonTemplateTranslator.convertToBool(arg, val), ';');
        break;

      case '-':
        this.body.push(dest, '= -', JsonTemplateTranslator.convertToSingleValue(arg, val), ';');
        break;

      case Keyword.TYPEOF:
        this.body.push(dest, '=typeof ', val, ';');
        break;
    }

    this.releaseVars(val);
  }
  private static escapeStr(s) {
    return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  }

  private static convertToBool(arg, varName) {
    switch (arg.type) {
      case SyntaxType.LOGICAL_EXPR:
        return varName;

      case SyntaxType.LITERAL:
        return `!!${varName}`;

      case SyntaxType.PATH:
        return `${varName}.length > 0`;

      default:
        return [
          '(typeof ',
          varName,
          '=== "boolean"?',
          varName,
          ':',
          'Array.isArray(',
          varName,
          ')?',
          varName,
          '.length > 0 : !!',
          varName,
          ')',
        ].join('');
    }
  }

  private static convertToSingleValue(arg, varName) {
    if (arg.type === SyntaxType.LITERAL) {
      return varName;
    }

    return `(Array.isArray(${varName}) ? ${varName}[0] : ${varName})`;
  }

  private static covertToArrayValue(varName) {
    return `${varName} = Array.isArray(${varName}) ? ${varName}.flat() : [${varName}];`;
  }

  private translateObjectFilterExpr(expr: ObjectFilterExpression, dest: string, ctx: string) {
    for (let filter of expr.filters) {
      if (filter.type === SyntaxType.OBJECT_INDEX_FILTER_EXPR) {
        this.translateObjectIndexFilterExpr(filter as IndexFilterExpression, dest, ctx);
        continue;
      }
      const resVar = this.acquireVar();
      const i = this.acquireVar();
      const len = this.acquireVar();
      const cond = this.acquireVar();
      const curItem = this.acquireVar();

      this.body.push(JsonTemplateTranslator.covertToArrayValue(dest));

      this.body.push(
        resVar,
        '= [];',
        i,
        '= 0;',
        len,
        '=',
        ctx,
        '.length;',
        'while(',
        i,
        '<',
        len,
        ') {',
        curItem,
        '=',
        ctx,
        '[',
        i,
        '++];',
      );
      this.translateExpr(filter, cond, curItem);
      this.body.push(
        JsonTemplateTranslator.convertToBool(filter, cond),
        '&&',
        resVar,
        '.push(',
        curItem,
        ');',
        '}',
        dest,
        '=',
        resVar,
        ';',
      );

      this.releaseVars(resVar, i, len, curItem, cond);
    }
  }

  private translateObjectIndexFilterExpr(expr: IndexFilterExpression, dest: string, ctx: string) {
    const keyVars: string[] = [];
    const resultVar = this.acquireVar();
    this.body.push(`${resultVar}={};`);
    for (let idx of expr.indexes) {
      const keyVar = this.acquireVar();
      this.translateExpr(idx, keyVar, ctx);
      this.body.push(`${resultVar}[${keyVar}] = ${ctx}[${keyVar}];`);
      keyVars.push(keyVar);
    }
    this.body.push(`${dest}=${resultVar};`);
    this.releaseVars(resultVar);
    this.releaseVars(...keyVars);
  }

  private translateArrayIndexFilterExpr(expr: IndexFilterExpression, dest: string, ctx: string) {
    this.body.push(JsonTemplateTranslator.covertToArrayValue(dest));
    const keyVars: string[] = [],
      valueVars: string[] = [];
    for (let idx of expr.indexes) {
      const key = this.acquireVar();
      const value = this.acquireVar();
      this.translateExpr(idx, key, ctx);
      this.body.push(`(${key} < 0 && (${key} = ${ctx}.length + ${key}));`);
      this.body.push(`${value} = ${ctx}[${key}];`);
      keyVars.push(key);
      valueVars.push(value);
    }
    if (expr.indexes.length === 1) {
      this.body.push(`${dest} = ${valueVars[0]};`);
    } else {
      this.body.push(`${dest} = [${valueVars.join(',')}];`);
    }
    this.releaseVars(...keyVars);
    this.releaseVars(...valueVars);
  }

  private translateRangeFilterExpr(expr: RangeFilterExpression, dest: string, ctx: string) {
    if (!expr.fromIdx && !expr.toIdx) {
      return;
    }
    this.body.push(JsonTemplateTranslator.covertToArrayValue(dest));
    let fromIdx, toIdx;
    if (expr.fromIdx) {
      if (expr.toIdx) {
        this.translateExpr(expr.fromIdx, (fromIdx = this.acquireVar()), ctx);
        this.translateExpr(expr.toIdx, (toIdx = this.acquireVar()), ctx);
        this.body.push(dest, '=', ctx, '.slice(', fromIdx, ',', toIdx, ');');
        this.releaseVars(fromIdx, toIdx);
      } else {
        this.translateExpr(expr.fromIdx, (fromIdx = this.acquireVar()), ctx);
        this.body.push(dest, '=', ctx, '.slice(', fromIdx, ');');
        this.releaseVars(fromIdx);
      }
    } else if (expr.toIdx) {
      this.translateExpr(expr.toIdx, (toIdx = this.acquireVar()), ctx);
      this.body.push(dest, '=', ctx, '.slice(0,', toIdx, ');');
      this.releaseVars(toIdx);
    }
  }

  private writeCondition(op: string, val1: any, val2: any) {
    this.body.push('if(', binaryOperators[op](val1, val2), ') {');
  }

  private translateMathExpr(expr: BinaryExpression, dest: string, ctx: string) {
    const val1 = this.acquireVar();
    const val2 = this.acquireVar();
    const { args } = expr;

    this.translateExpr(args[0], val1, ctx);
    this.translateExpr(args[1], val2, ctx);

    this.body.push(
      dest,
      '=',
      binaryOperators[expr.op](
        JsonTemplateTranslator.convertToSingleValue(args[0], val1),
        JsonTemplateTranslator.convertToSingleValue(args[1], val2),
      ),
      ';',
    );

    this.releaseVars(val1, val2);
  }

  private translateLogicalExpr(expr: BinaryExpression, dest: string, ctx: string) {
    const conditionVars: any[] = [];
    const { args } = expr;
    let len = args.length;
    let i = 0;
    let val;

    this.body.push(dest, '= false;');
    switch (expr.op) {
      case '&&':
        while (i < len) {
          val = this.acquireVar();
          conditionVars.push(val);
          this.translateExpr(args[i], val, ctx);
          this.body.push('if(', JsonTemplateTranslator.convertToBool(args[i++], val), ') {');
        }
        this.body.push(dest, '= true;');
        break;

      case '||':
        while (i < len) {
          conditionVars.push((val = this.acquireVar()));
          this.translateExpr(args[i], val, ctx);
          this.body.push(
            'if(',
            JsonTemplateTranslator.convertToBool(args[i], val),
            ') {',
            dest,
            '= true;',
            '}',
          );
          if (i++ + 1 < len) {
            this.body.push('else {');
          }
        }
        --len;
        break;
    }

    while (len--) {
      this.body.push('}');
    }

    this.releaseVars(conditionVars);
  }
}
