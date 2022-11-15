import { DATA_PARAM_KEY, RESULT_KEY, VARS_PREFIX } from './constants';
import { JsosTemplateTranslatorError } from './errors';
import { binaryOperators } from './operators';
import {
  ArrayExpression,
  AssignmentExpression,
  BinaryExpression,
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
  DefinitionExpression,
  SpreadExpression,
  LambdaArgExpression,
  ToArrayExpression,
  ContextVariable,
} from './types';

export class JsonTemplateTranslator {
  private vars: string[] = [];
  private lastVarId = 0;
  private unusedVars: string[] = [];
  private expr: Expression;

  constructor(expr: Expression) {
    this.expr = expr;
  }

  private init() {
    this.vars = [];
    this.lastVarId = 0;
    this.unusedVars = [];
  }

  private acquireVar(): string {
    if (this.unusedVars.length) {
      return this.unusedVars.shift() as string;
    }

    const varName = `${VARS_PREFIX}${++this.lastVarId}`;
    this.vars.push(varName);
    return varName;
  }

  private acquireVars(numVars = 1): string[] {
    const vars: string[] = [];
    for (let i = 0; i < numVars; i++) {
      vars.push(this.acquireVar());
    }
    return vars;
  }

  private releaseVars(...args: any[]) {
    let i = args.length;
    while (i--) {
      this.unusedVars.push(args[i]);
    }
  }

  translate(): string {
    this.init();
    let code: string[] = [];
    const exprCode = this.translateExpr(this.expr, RESULT_KEY, DATA_PARAM_KEY);

    code.push(
      '"use strict";',
      'const concat = Array.prototype.concat;',
      `let ${RESULT_KEY} = undefined;`,
      this.vars.map((elm) => `let ${elm};`).join(''),
    );
    code.push(exprCode);
    code.push(`return ${RESULT_KEY};`);

    return code.join('');
  }

  private translateExpr(expr: Expression, dest: string, ctx: string): string {
    switch (expr.type) {
      case SyntaxType.STATEMENTS_EXPR:
        return this.translateStatementsExpr(expr as StatementsExpression, dest, ctx);

      case SyntaxType.PATH:
        return this.translatePath(expr as PathExpression, dest, ctx);

      case SyntaxType.COMPARISON_EXPR:
        return this.translateComparisonExpr(expr as BinaryExpression, dest, ctx);

      case SyntaxType.MATH_EXPR:
        return this.translateMathExpr(expr as BinaryExpression, dest, ctx);

      case SyntaxType.LOGICAL_EXPR:
        return this.translateLogicalExpr(expr as BinaryExpression, dest, ctx);

      case SyntaxType.UNARY_EXPR:
        return this.translateUnaryExpr(expr as UnaryExpression, dest, ctx);

      case SyntaxType.LAMBDA_ARG:
        return this.translateLambdaArgExpr(expr as LambdaArgExpression, dest, ctx);

      case SyntaxType.SPREAD_EXPR:
        return this.translateSpreadExpr(expr as SpreadExpression, dest, ctx);

      case SyntaxType.LITERAL:
        return this.translateLiteralExpr(expr as LiteralExpression, dest, ctx);

      case SyntaxType.ARRAY_EXPR:
        return this.translateArrayExpr(expr as ArrayExpression, dest, ctx);

      case SyntaxType.OBJECT_EXPR:
        return this.translateObjectExpr(expr as ObjectExpression, dest, ctx);

      case SyntaxType.FUNCTION_EXPR:
        return this.translateFunctionExpr(expr as FunctionExpression, dest, ctx);

      case SyntaxType.FUNCTION_CALL_EXPR:
        return this.translateFunctionCallExpr(expr as FunctionCallExpression, dest, ctx);

      case SyntaxType.DEFINTION_EXPR:
        return this.translateDefinitionExpr(expr as DefinitionExpression, dest, ctx);

      case SyntaxType.ASSIGNMENT_EXPR:
        return this.translateAssignmentExpr(expr as AssignmentExpression, dest, ctx);

      case SyntaxType.OBJECT_FILTER_EXPR:
        return this.translateObjectFilterExpr(expr as ObjectFilterExpression, dest, ctx);

      case SyntaxType.RANGE_FILTER_EXPR:
        return this.translateRangeFilterExpr(expr as RangeFilterExpression, dest, ctx);

      case SyntaxType.ARRAY_INDEX_FILTER_EXPR:
        return this.translateIndexFilterExpr(expr as IndexFilterExpression, dest, ctx);

      case SyntaxType.OBJECT_INDEX_FILTER_EXPR:
        return this.translateIndexFilterExpr(expr as IndexFilterExpression, dest, ctx);

      case SyntaxType.SELECTOR:
        return this.translateSelector(expr as SelectorExpression, dest, ctx);

      case SyntaxType.TO_ARRAY_EXPR:
        return this.translateToArrayExpr(expr as ToArrayExpression, dest, ctx);
      default:
        return '';
    }
  }

  private pathContainsVariables(expr: PathExpression): boolean {
    return (
      !!expr.parts &&
      expr.parts
        .filter((part) => part.type === SyntaxType.SELECTOR)
        .map((part) => part as SelectorExpression)
        .some((part) => part.contextVar || part.posVar)
    );
  }

  private translateLambdaArgExpr(expr: LambdaArgExpression, dest: string, ctx: string): string {
    return `${dest} = args[${expr.index}];`;
  }

  private translateToArrayExpr(expr: ToArrayExpression, dest: string, ctx: string): string {
    const code: string[] = [];
    code.push(this.translateExpr(expr.value, dest, ctx));
    code.push(JsonTemplateTranslator.covertToArrayValue(dest));
    return code.join('');
  }

  private translateSpreadExpr(expr: SpreadExpression, dest: string, ctx: string): string {
    return this.translateExpr(expr.value, dest, ctx);
  }

  private translateAsBlockExpr(expr: Expression, dest: string, ctx: string): string {
    const blockExpr: FunctionExpression = {
      type: SyntaxType.FUNCTION_EXPR,
      block: true,
      statements: [expr],
    };
    return this.translateFunctionExpr(blockExpr, dest, ctx);
  }

  private translatePathRoot(
    root: Expression | string | undefined,
    dest: string,
    ctx: string,
  ): string {
    if (typeof root === 'object') {
      return this.translateExpr(root, dest, ctx);
    } else {
      return `${dest} = ${root || ctx};`;
    }
  }

  private translatePath(expr: PathExpression, dest: string, baseCtx: string): string {
    if (!expr.block && this.pathContainsVariables(expr)) {
      expr.block = true;
      return this.translateAsBlockExpr(expr, dest, baseCtx);
    }
    const rootCode = this.translatePathRoot(expr.root, dest, baseCtx);
    if (!expr.parts.length) {
      return rootCode;
    }
    let code: string[] = [rootCode];
    const numParts = expr.parts.length;
    const dataVars = this.acquireVars(numParts);
    const indexVars = this.acquireVars(numParts);
    const itemVars = this.acquireVars(numParts);
    const resultVar = this.acquireVar();
    code.push(resultVar, '= [];');
    code.push(dataVars[0], '=', dest, ';');
    for (let i = 0; i < numParts; i++) {
      const part = expr.parts[i];
      const idx = indexVars[i];
      const item = itemVars[i];
      const data = dataVars[i];
      code.push(JsonTemplateTranslator.covertToArrayValue(data));
      if (part.type === SyntaxType.ARRAY_INDEX_FILTER_EXPR) {
        code.push(`${data} = [${data}];`);
      }
      code.push(`for(let ${idx}=0; ${idx}<${data}.length; ${idx}++) {`);
      code.push(`${item} = ${data}[${idx}];`);
      if (i > 0 && expr.parts[i - 1].context) {
        const context = expr.parts[i - 1].context as ContextVariable;
        if (context.item) {
          code.push(`let ${context.item} = ${item};`);
        }
        if (context.index) {
          code.push(`let ${context.index} = ${idx};`);
        }
      }
      code.push(this.translateExpr(part, item, item));
      code.push('if(!', item, ') { continue; }');
      if (i < numParts - 1) {
        code.push(dataVars[i + 1], '=', item, ';');
      } else {
        code.push(JsonTemplateTranslator.covertToArrayValue(item));
        code.push(`${resultVar}.push(...${item});`);
      }
    }
    for (let i = 0; i < numParts; i++) {
      code.push('}');
    }
    this.releaseVars(...indexVars);
    this.releaseVars(...itemVars);
    this.releaseVars(...dataVars);
    this.releaseVars(resultVar);
    code.push(dest, '=', JsonTemplateTranslator.returnSingleValueIfPossible(resultVar), ';');
    return code.join('');
  }

  private translateCurrentSelector(expr: SelectorExpression, dest, ctx) {
    if (!expr.prop) {
      return '';
    }
    const code: string[] = [];
    const prop = expr.prop.value;
    if (prop === '*') {
      code.push(`${dest} = Object.values(${ctx});`);
    } else {
      const propStr = JsonTemplateTranslator.escapeStr(prop);
      code.push(`if(${ctx}.hasOwnProperty(${propStr})){`);
      code.push(`${dest}=${ctx}[${propStr}];`);
      code.push('} else {');
      code.push(`${dest} = undefined`);
      code.push('}');
    }
    return code.join('');
  }

  private translateParentSelector(expr: SelectorExpression, dest: string, ctx: string): string {
    if (!expr.parent) {
      throw new JsosTemplateTranslatorError('Parent is undefined');
    }
    return `${dest} = ${expr.parent};`;
  }

  private translateSelector(expr: SelectorExpression, dest: string, ctx: string): string {
    if (expr.selector === '.') {
      return this.translateCurrentSelector(expr, dest, ctx);
    }
    return this.translateDescendantSelector(expr, dest, ctx);
  }

  private translateDescendantSelector(
    expr: SelectorExpression,
    dest: string,
    baseCtx: string,
  ): string {
    let code: string[] = [];
    const ctxs = this.acquireVar();
    const currCtx = this.acquireVar();
    const result = this.acquireVar();

    code.push(`${result} = [];`);
    const { prop } = expr;
    const propStr = JsonTemplateTranslator.escapeStr(prop?.value);
    code.push(`${ctxs}=[${baseCtx}];`);
    code.push(`while(${ctxs}.length){`);
    code.push(`${currCtx} = ${ctxs}.shift();`);
    code.push(`if(!${currCtx}){continue;}`);
    code.push(`if(Array.isArray(${currCtx})){`);
    code.push(`${ctxs} = ${ctxs}.concat(${currCtx});`);
    code.push('continue;');
    code.push('}');
    code.push(`if(typeof ${currCtx} === "object") {`);
    code.push(`${ctxs} = ${ctxs}.concat(Object.values(${currCtx}));`);
    if (prop) {
      if (prop?.value === '*') {
        code.push(`${result} = ${result}.concat(Object.values(${currCtx}));`);
      } else {
        code.push(`if(${currCtx}.hasOwnProperty(${propStr})){`);
        code.push(`${result}.push(${currCtx}[${propStr}]);`);
        code.push('}');
      }
    }
    code.push('}');
    if (!prop) {
      code.push(`${result}.push(${currCtx});`);
    }
    code.push('}');
    code.push(`${dest} = ${result}.flat();`);
    return code.join('');
  }

  private translateFunctionExpr(expr: FunctionExpression, dest: string, ctx: string): string {
    let code: string[] = [];
    code.push(dest, '= function(', (expr.params || []).join(','), '){');
    const returnVal = this.acquireVar();
    code.push(`let ${returnVal} = undefined;`);
    code.push(this.translateStatements(expr.statements, returnVal, ctx));
    code.push('return ', returnVal, ';}');
    if (expr.block) {
      code.push('()');
    }
    code.push(';');
    this.releaseVars(returnVal);
    return code.join('');
  }

  private getFunctionName(expr: FunctionCallExpression, ctx: string): string {
    return expr.dot ? `${ctx}.${expr.id}` : expr.id || ctx;
  }

  private translateFunctionCallExpr(
    expr: FunctionCallExpression,
    dest: string,
    ctx: string,
  ): string {
    let code: string[] = [];
    const resultVar = this.acquireVar();
    code.push(resultVar, '=', ctx, ';');
    if (expr.object) {
      code.push(this.translateExpr(expr.object, resultVar, ctx));
    }
    if (!expr.id) {
      code.push(JsonTemplateTranslator.convertToSingleValue(resultVar));
    }
    const functionArgsStr = this.translateSpreadableExpressions(expr.args, resultVar, code);
    code.push(dest, '=', this.getFunctionName(expr, resultVar), '(', functionArgsStr, ');');
    return code.join('');
  }

  private translateObjectExpr(expr: ObjectExpression, dest: string, ctx: string): string {
    let code: string[] = [];
    const propExprs: string[] = [];
    const vars: string[] = [];
    for (let prop of expr.props) {
      const propParts: string[] = [];
      if (prop.key) {
        if (typeof prop.key !== 'string') {
          const keyVar = this.acquireVar();
          code.push(this.translateExpr(prop.key, keyVar, ctx));
          propParts.push(`[${keyVar}]`);
          vars.push(keyVar);
        } else {
          propParts.push(prop.key);
        }
        propParts.push(':');
      }
      const valueVar = this.acquireVar();
      code.push(this.translateExpr(prop.value, valueVar, ctx));
      if (prop.value.type === SyntaxType.SPREAD_EXPR) {
        propParts.push('...');
      }
      propParts.push(valueVar);
      propExprs.push(propParts.join(''));
      vars.push(valueVar);
    }
    code.push(dest, '={', propExprs.join(','), '};');
    this.releaseVars(...vars);
    return code.join('');
  }

  private translateSpreadableExpressions(items: Expression[], ctx: string, code: string[]): string {
    const vars: string[] = [];
    const itemParts: string[] = [];
    for (let item of items) {
      const varName = this.acquireVar();
      code.push(this.translateExpr(item, varName, ctx));
      itemParts.push(item.type === SyntaxType.SPREAD_EXPR ? `...${varName}` : varName);
      vars.push(varName);
    }
    this.releaseVars(...vars);
    return itemParts.join(',');
  }

  private translateArrayExpr(expr: ArrayExpression, dest: string, ctx: string): string {
    const code: string[] = [];
    const elementsStr = this.translateSpreadableExpressions(expr.elements, ctx, code);
    code.push(`${dest} = [${elementsStr}];`);
    return code.join('');
  }

  private translateLiteralExpr(expr: LiteralExpression, dest: string, _ctx: string): string {
    const literalCode = this.translateLiteral(expr.value);
    return `${dest} = ${literalCode};`;
  }

  private translateAssignmentExpr(expr: AssignmentExpression, dest: string, ctx: string): string {
    const code: string[] = [];
    const valueVar = this.acquireVar();
    code.push(this.translateExpr(expr.value, valueVar, ctx));
    const assignmentPathParts: string[] = [];
    if (!expr.root || expr.root === DATA_PARAM_KEY) {
      throw new JsosTemplateTranslatorError('Invalid assignment path');
    }
    assignmentPathParts.push(expr.root);
    for (let part of expr.parts) {
      let expr: SelectorExpression | IndexFilterExpression;
      switch (part.type) {
        case SyntaxType.SELECTOR:
          expr = part as SelectorExpression;
          if (expr.selector !== '.' || expr.prop?.type !== TokenType.ID) {
            throw new JsosTemplateTranslatorError('Invalid assignment path');
          }
          assignmentPathParts.push('.', expr.prop.value);
          break;
        case SyntaxType.ARRAY_INDEX_FILTER_EXPR:
          expr = part as IndexFilterExpression;
          if (expr.indexes.elements.length > 1) {
            throw new JsosTemplateTranslatorError('Invalid assignment path');
          }
          const keyVar = this.acquireVar();
          code.push(this.translateExpr(expr.indexes.elements[0], keyVar, ctx));
          assignmentPathParts.push('[', keyVar, ']');
          break;
        default:
          throw new JsosTemplateTranslatorError('Invalid assignment path');
      }
    }
    const assignmentPath = assignmentPathParts.join('');
    code.push(`${assignmentPath}=${valueVar};`);
    code.push(`${dest} = ${valueVar};`);
    this.releaseVars(valueVar);
    return code.join('');
  }

  private translateDefinitionVars(expr: DefinitionExpression): string {
    let vars: string[] = [expr.vars.join(',')];
    if (expr.fromObject) {
      vars.unshift('{');
      vars.push('}');
    }
    return vars.join('');
  }

  private translateDefinitionExpr(expr: DefinitionExpression, dest: string, ctx: string): string {
    const code: string[] = [];
    const valueVar = this.acquireVar();
    code.push(this.translateExpr(expr.value, valueVar, ctx));
    const defVars = this.translateDefinitionVars(expr);
    code.push(`${expr.definition} ${defVars}=${valueVar};`);
    code.push(`${dest} = ${valueVar};`);
    this.releaseVars(valueVar);
    return code.join('');
  }

  private translateStatementsExpr(expr: StatementsExpression, dest: string, ctx: string): string {
    return this.translateStatements(expr.statements, dest, ctx);
  }

  private translateStatements(statements: Expression[], dest: string, ctx: string): string {
    return statements.map((statement) => this.translateExpr(statement, dest, ctx)).join('');
  }

  private translateComparisonExpr(expr: BinaryExpression, dest: string, ctx: string): string {
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
    const code: string[] = [];
    code.push(dest, '= false;');

    code.push(this.translateExpr(leftArg, val1, ctx));
    code.push(this.translateExpr(rightArg, val2, ctx));

    code.push(`${isVal1Array}=Array.isArray(${val1});`);
    code.push(`${isVal2Array}=Array.isArray(${val2});`);

    code.push(`if(${isVal1Array} && ${val1}.length === 1) {`);
    code.push(`${val1}=${val1}[0]; ${isVal1Array}=false;}`);
    code.push(`if(${isVal2Array} && ${val2}.length === 1) {`);
    code.push(`${val2}=${val2}[0]; ${isVal2Array}=false;}`);

    code.push(`${i}=0;if(${isVal1Array}){${len1}=${val1}.length;`);
    code.push(`if(${isVal2Array}){${len2}=${val2}.length;`);

    code.push(
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
    code.push(this.writeCondition(expr.op, `${val1}[${i}]`, `${val2}[${j}]`));
    code.push(dest, '= true;', 'break;', '}', '++', j, ';', '}', '++', i, ';', '}', '}', 'else {');

    code.push('while(', i, '<', len1, ') {');
    code.push(this.writeCondition(expr.op, `${val1}[${i}]`, val2));
    code.push(dest, '= true;', 'break;', '}', '++', i, ';', '}');

    code.push('}');

    code.push('}');

    code.push(
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
    code.push(this.writeCondition(expr.op, val1, `${val2}[${j}]`));
    code.push(dest, '= true;', 'break;', '}', '++', i, ';', '}', '}');

    code.push('else {', dest, '=', binaryOperators[expr.op](val1, val2), ';', '}');

    this.releaseVars(val1, val2, isVal1Array, isVal2Array, i, j, len1, len2);
    return code.join('');
  }

  private inlineAppendToArray(result, val, tmpArr?, len?) {
    const code: string[] = [];
    code.push(`if(${val} !== undefined) {if(Array.isArray(${val})) {`);
    if (tmpArr) {
      code.push(len, '> 1?');
      code.push(this.inlinePushToArray(tmpArr, val));
      code.push(':');
    }
    code.push(`${result} = ${result}.length ? ${result}.concat(${val}) : ${val}.slice();`);
    code.push('} else {');
    if (tmpArr) {
      code.push(`if(${tmpArr}.length) {`);
      code.push(`${result} = ${result}.concat(tmpArr);`);
      code.push(`${tmpArr} = [];}`);
    }
    code.push(this.inlinePushToArray(result, val));
    code.push(';', '}', '}');
    return code.join('');
  }

  private inlinePushToArray(result, val): string {
    //TODO check this later if this is ok
    return `${result}.length ? ${result}.push(${val}): (${result}[0] = ${val})`;
  }

  private translateLiteral(val): string {
    if (typeof val === 'string') {
      return JsonTemplateTranslator.escapeStr(val);
    }
    return String(val);
  }

  private translateUnaryExpr(expr: UnaryExpression, dest: string, ctx: string): string {
    const val = this.acquireVar();
    const { arg } = expr;
    const code: string[] = [];
    code.push(this.translateExpr(arg, val, ctx));

    switch (expr.op) {
      case '!':
        code.push(dest, '= !', JsonTemplateTranslator.convertToBool(arg, val), ';');
        break;

      case '-':
        code.push(dest, '= -', JsonTemplateTranslator.returnSingleValue(arg, val), ';');
        break;

      case Keyword.TYPEOF:
        code.push(dest, '= typeof ', val, ';');
        break;
    }

    this.releaseVars(val);
    return code.join('');
  }

  private static escapeStr(s?: string): string {
    if (!s) {
      return '';
    }
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

  private static returnSingleValue(arg: Expression, varName: string): string {
    if (arg.type === SyntaxType.LITERAL) {
      return varName;
    }

    return `(Array.isArray(${varName}) ? ${varName}[0] : ${varName})`;
  }

  private static convertToSingleValue(varName: string): string {
    return `${varName} = Array.isArray(${varName}) ? ${varName}[0] : ${varName};`;
  }

  private static returnSingleValueIfPossible(varName: string): string {
    return `(${varName}.length === 1 ? ${varName}[0] : ${varName})`;
  }

  private static covertToArrayValue(varName: string) {
    return `${varName} = Array.isArray(${varName}) ? ${varName} : [${varName}];`;
  }

  private translateObjectFilterExpr(
    expr: ObjectFilterExpression,
    dest: string,
    ctx: string,
  ): string {
    const code: string[] = [];
    for (let filter of expr.filters) {
      if (filter.type === SyntaxType.OBJECT_INDEX_FILTER_EXPR) {
        code.push(this.translateIndexFilterExpr(filter as IndexFilterExpression, dest, ctx));
        continue;
      }
      const condition = this.acquireVar();

      code.push(this.translateExpr(filter, condition, ctx));
      const conditionCode = JsonTemplateTranslator.convertToBool(filter, condition);
      code.push(`if(!${conditionCode}) {${dest} = undefined;}`);
      this.releaseVars(condition);
    }
    return code.join('');
  }

  private translateIndexFilterExpr(expr: IndexFilterExpression, dest: string, ctx: string): string {
    const code: string[] = [];
    const allKeys = this.acquireVar();
    code.push(this.translateArrayExpr(expr.indexes, allKeys, ctx));
    code.push(`${allKeys} = ${allKeys}.flat();`);
    const resultVar = this.acquireVar();
    if (expr.type === SyntaxType.OBJECT_INDEX_FILTER_EXPR) {
      if (expr.exclude) {
        code.push(`${allKeys}=Object.keys(${ctx}).filter(key => !${allKeys}.includes(key));`);
      }
      code.push(`${resultVar} = {};`);
      code.push(`for(let key of ${allKeys}){`);
      code.push(`${resultVar}[key] = ${ctx}[key];`);
      code.push('}');
    } else {
      code.push(`${resultVar} = [];`);
      code.push(`for(let key of ${allKeys}){`);
      code.push(`if(key < 0){key = ${ctx}.length + key;}`);
      code.push(`if(${ctx}.hasOwnProperty(key)){${resultVar}.push(${ctx}[key]);}`);
      code.push('}');
      code.push(`if(${allKeys}.length === 1) {${resultVar} = ${resultVar}[0];}`);
    }
    code.push(`${dest}=${resultVar};`);
    this.releaseVars(allKeys);
    this.releaseVars(resultVar);
    return code.join('');
  }

  private translateRangeFilterExpr(expr: RangeFilterExpression, dest: string, ctx: string): string {
    if (!expr.fromIdx && !expr.toIdx) {
      return '';
    }
    const code: string[] = [];
    let fromIdx, toIdx;
    if (expr.fromIdx) {
      if (expr.toIdx) {
        code.push(this.translateExpr(expr.fromIdx, (fromIdx = this.acquireVar()), ctx));
        code.push(this.translateExpr(expr.toIdx, (toIdx = this.acquireVar()), ctx));
        code.push(dest, '=', ctx, '.slice(', fromIdx, ',', toIdx, ');');
        this.releaseVars(fromIdx, toIdx);
      } else {
        code.push(this.translateExpr(expr.fromIdx, (fromIdx = this.acquireVar()), ctx));
        code.push(dest, '=', ctx, '.slice(', fromIdx, ');');
        this.releaseVars(fromIdx);
      }
    } else if (expr.toIdx) {
      code.push(this.translateExpr(expr.toIdx, (toIdx = this.acquireVar()), ctx));
      code.push(dest, '=', ctx, '.slice(0,', toIdx, ');');
      this.releaseVars(toIdx);
    }
    return code.join('');
  }

  private writeCondition(op: string, val1: any, val2: any): string {
    return `if(${binaryOperators[op](val1, val2)}) {`;
  }

  private translateMathExpr(expr: BinaryExpression, dest: string, ctx: string): string {
    const val1 = this.acquireVar();
    const val2 = this.acquireVar();
    const { args } = expr;
    const code: string[] = [];
    code.push(this.translateExpr(args[0], val1, ctx));
    code.push(this.translateExpr(args[1], val2, ctx));

    code.push(
      dest,
      '=',
      binaryOperators[expr.op](
        JsonTemplateTranslator.returnSingleValue(args[0], val1),
        JsonTemplateTranslator.returnSingleValue(args[1], val2),
      ),
      ';',
    );

    this.releaseVars(val1, val2);
    return code.join('');
  }

  private translateLogicalExpr(expr: BinaryExpression, dest: string, ctx: string): string {
    const conditionVars: any[] = [];
    const { args } = expr;
    let len = args.length;
    let i = 0;
    let val;
    const code: string[] = [];
    code.push(dest, '= false;');
    switch (expr.op) {
      case '&&':
        while (i < len) {
          val = this.acquireVar();
          conditionVars.push(val);
          code.push(this.translateExpr(args[i], val, ctx));
          code.push('if(', JsonTemplateTranslator.convertToBool(args[i++], val), ') {');
        }
        code.push(dest, '= true;');
        break;

      case '||':
        while (i < len) {
          val = this.acquireVar();
          conditionVars.push(val);
          code.push(this.translateExpr(args[i], val, ctx));
          code.push(
            'if(',
            JsonTemplateTranslator.convertToBool(args[i], val),
            ') {',
            dest,
            '= true;',
            '}',
          );
          if (i++ + 1 < len) {
            code.push('else {');
          }
        }
        --len;
        break;
    }

    while (len--) {
      code.push('}');
    }

    this.releaseVars(conditionVars);
    return code.join('');
  }
}
