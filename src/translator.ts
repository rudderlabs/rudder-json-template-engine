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
  ObjectExpression,
  ObjectPredicateExpression,
  PathExpression,
  PosExpression,
  SelectorExpression,
  StatementsExpression,
  SyntaxType,
  UnaryExpression,
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

  translate(): string {
    if (!this.code) {
      this.translateExpr(this.expr, 'res', 'data');

      this.body.unshift(
        'const isArr = Array.isArray;',
        'const concat = Array.prototype.concat;',
        'let res = undefined;',
        this.vars.map((elm) => `let ${elm}`).join(';'),
        ';',
      );

      this.body.push('return res;');

      this.code = this.body.join('');
    }
    return this.code;
  }

  private acquireVar(): string {
    if (this.unusedVars.length) {
      return this.unusedVars.shift() as string;
    }

    const varName = `__${++this.lastVarId}`;
    this.vars.push(varName);
    return varName;
  }

  private releaseVars(...args: any[]) {
    let i = args.length;
    while (i--) {
      this.unusedVars.push(args[i]);
    }
  }

  private translatePath(expr: PathExpression, dest: string, ctx: string) {
    const parts = expr.parts;
    let i = 0;
    const len = parts.length;

    let value = expr.root || ctx;

    this.body.push(dest, '=', value, ';', JsonTemplateTranslator.covertToArrayValue(dest));

    while (i < len) {
      const item = parts[i++];
      switch (item.type) {
        case SyntaxType.SELECTOR:
          item.selector === '..'
            ? this.translateDescendantSelector(item as SelectorExpression, dest, dest)
            : this.translateSelector(item as SelectorExpression, dest, dest);
          break;

        case SyntaxType.OBJ_PRED:
          this.translateObjectPredicate(item as ObjectPredicateExpression, dest, dest);
          break;

        case SyntaxType.POS_EXPR:
          this.translatePosExpression(item as PosExpression, dest, dest);
          break;

        case SyntaxType.CONCAT_EXPR:
          this.translateConcatExpr(item as ConcatExpression, dest, dest);
          break;

        case SyntaxType.MATH_EXPR:
          this.translateMathExpr(item as BinaryExpression, dest, dest);
          break;
      }
    }
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
    const res = this.acquireVar();

    this.body.push(
      ctx,
      '=',
      baseCtx,
      '.slice(),',
      res,
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
      'if(isArr(',
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
      if (prop !== '*') {
        this.body.push(val, '=', curCtx, `["${prop}"];`);
        this.inlineAppendToArray(res, val);
      }
    } else {
      this.inlineAppendToArray(res, curCtx);
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
    prop === '*' && this.inlineAppendToArray(res, val);
    this.body.push('}', '}');
    prop || this.body.push('}');
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
      res,
      ';',
    );

    this.releaseVars(ctx, curCtx, childCtxs, i, j, val, len, res);
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

    this.body.push(dest, '= concat.call(', argVars.join(','), ');');

    this.releaseVars(argVars);
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
    }
  }

  private translateFunctionExpr(expr: FunctionExpression, dest: string, ctx: string) {
    this.body.push(dest, '= (', expr.params.join(','), ') => {');
    const returnVal = this.acquireVar();
    this.body.push(`let ${returnVal} = undefined;`);
    this.translateStatementsExpr(expr.body, returnVal, ctx);
    this.body.push('return ', returnVal, ';};');
    this.releaseVars(returnVal);
  }

  private translateFunctionCallExpr(expr: FunctionCallExpression, dest: string, ctx: string) {
    const vars: string[] = [];
    const functionArgs: string[] = [];
    for (let arg of expr.args) {
      const varName = this.acquireVar();
      this.translateExpr(arg, varName, ctx);
      vars.push(varName);
      if (arg.type === SyntaxType.UNARY_EXPR && arg.op === '...') {
        functionArgs.push(`...${varName}`);
      } else {
        functionArgs.push(varName);
      }
    }
    this.body.push(dest, '=', expr.id, '(', functionArgs.join(','), ');');
    this.releaseVars(...vars);
  }

  private translateObjectExpr(expr: ObjectExpression, dest: string, ctx: string) {
    const propExprs: string[] = [];
    const vars: string[] = [];
    for (let key in expr.props) {
      const varName = this.acquireVar();
      this.translateExpr(expr.props[key], varName, ctx);
      propExprs.push(`"${key}":${varName}`);
      vars.push(varName);
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

  private translateAssignmentExpr(expr: AssignmentExpression, _dest: string, ctx: string) {
    if (!expr.id.includes('.')) {
      this.body.push('let ', expr.id, ';');
    }
    this.translateExpr(expr.value, expr.id, ctx);
  }

  private translateStatementsExpr(expr: StatementsExpression, dest: string, ctx: string) {
    for (let statement of expr.statements) {
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

    const isLeftArgPath = leftArg.type === SyntaxType.PATH;
    const isRightArgLiteral = rightArg.type === SyntaxType.LITERAL;

    this.body.push(isVal1Array, '=');
    isLeftArgPath ? this.body.push('true;') : this.body.push('isArr(', val1, ');');

    this.body.push(isVal2Array, '=');
    isRightArgLiteral ? this.body.push('false;') : this.body.push('isArr(', val2, ');');

    this.body.push('if(');
    isLeftArgPath || this.body.push(isVal1Array, '&&');
    this.body.push(val1, '.length === 1) {', val1, '=', val1, '[0];', isVal1Array, '= false;', '}');
    isRightArgLiteral ||
      this.body.push(
        'if(',
        isVal2Array,
        '&&',
        val2,
        '.length === 1) {',
        val2,
        '=',
        val2,
        '[0];',
        isVal2Array,
        '= false;',
        '}',
      );

    this.body.push(i, '= 0;', 'if(', isVal1Array, ') {', len1, '=', val1, '.length;');

    if (!isRightArgLiteral) {
      this.body.push(
        'if(',
        isVal2Array,
        ') {',
        len2,
        '=',
        val2,
        '.length;',
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
    }
    this.body.push('while(', i, '<', len1, ') {');
    this.writeCondition(expr.op, [val1, '[', i, ']'].join(''), val2);
    this.body.push(dest, '= true;', 'break;', '}', '++', i, ';', '}');

    isRightArgLiteral || this.body.push('}');

    this.body.push('}');

    if (!isRightArgLiteral) {
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
    }

    this.body.push('else {', dest, '=', binaryOperators[expr.op](val1, val2), ';', '}');

    this.releaseVars(val1, val2, isVal1Array, isVal2Array, i, j, len1, len2);
  }

  private inlineAppendToArray(res, val, tmpArr?, len?) {
    this.body.push('if(typeof ', val, '!== "undefined") {', 'if(isArr(', val, ')) {');
    if (tmpArr) {
      this.body.push(len, '> 1?');
      this.inlinePushToArray(tmpArr, val);
      this.body.push(':');
    }
    this.body.push(
      res,
      '=',
      res,
      '.length?',
      res,
      '.concat(',
      val,
      ') :',
      val,
      '.slice()',
      ';',
      '}',
      'else {',
    );
    tmpArr &&
      this.body.push(
        'if(',
        tmpArr,
        '.length) {',
        res,
        '= concat.apply(',
        res,
        ',',
        tmpArr,
        ');',
        tmpArr,
        '= [];',
        '}',
      );
    this.inlinePushToArray(res, val);
    this.body.push(';', '}', '}');
  }

  private inlinePushToArray(res, val) {
    this.body.push(res, '.length?', res, '.push(', val, ') :', res, '[0] =', val);
  }

  private translateLiteral(val) {
    this.body.push(
      typeof val === 'string' ? JsonTemplateTranslator.escapeStr(val) : val === null ? 'null' : val,
    );
  }

  private translateSelector(sel: SelectorExpression, dest: string, ctx: string) {
    if (sel.prop) {
      const propStr = JsonTemplateTranslator.escapeStr(sel.prop);
      const res = this.acquireVar();
      const i = this.acquireVar();
      const len = this.acquireVar();
      const curCtx = this.acquireVar();
      const j = this.acquireVar();
      const val = this.acquireVar();
      const tmpArr = this.acquireVar();

      this.body.push(
        res,
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
      if (sel.prop === '*') {
        this.body.push(
          'if(typeof ',
          curCtx,
          '=== "object") {',
          'if(isArr(',
          curCtx,
          ')) {',
          res,
          '=',
          res,
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
        this.inlineAppendToArray(res, val);
        this.body.push('}', '}', '}', '}');
      } else {
        this.body.push(val, '=', curCtx, '[', propStr, '];');
        this.inlineAppendToArray(res, val, tmpArr, len);
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
        res,
        ',',
        tmpArr,
        ') :',
        res,
        '.concat(',
        tmpArr,
        '[0]) :',
        res,
        ';',
      );

      this.releaseVars(res, i, len, curCtx, j, val, tmpArr);
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

      case '...':
        this.body.push(dest, '=', val, ';', JsonTemplateTranslator.covertToArrayValue(dest));
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
          'isArr(',
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

    return `(isArr(${varName}) ? ${varName}[0] : ${varName})`;
  }

  private static covertToArrayValue(varName) {
    return `(isArr(${varName}) || (${varName} = [${varName}]));`;
  }

  private translateObjectPredicate(expr: ObjectPredicateExpression, dest: string, ctx: string) {
    const resVar = this.acquireVar();
    const i = this.acquireVar();
    const len = this.acquireVar();
    const cond = this.acquireVar();
    const curItem = this.acquireVar();

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
    this.translateExpr(expr.arg, cond, curItem);
    this.body.push(
      JsonTemplateTranslator.convertToBool(expr.arg, cond),
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

  private translatePosExpression(expr: PosExpression, dest: string, ctx: string) {
    let fromIdx;
    let toIdx;
    if (expr.idx) {
      const idx = this.acquireVar();
      this.translateExpr(expr.idx, idx, ctx);

      this.body.push(
        idx,
        '< 0 && (',
        idx,
        '=',
        ctx,
        '.length +',
        idx,
        ');',
        dest,
        '=',
        ctx,
        '[',
        idx,
        '];',
      );
      this.releaseVars(idx);
      return false;
    }
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
