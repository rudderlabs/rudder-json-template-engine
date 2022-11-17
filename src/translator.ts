import { DATA_PARAM_KEY, FUNCTION_RESULT_KEY, RESULT_KEY, VARS_PREFIX } from './constants';
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
  FilterExpression,
} from './types';
import { CommonUtils } from './utils';

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

  translate(dest = RESULT_KEY, ctx = DATA_PARAM_KEY): string {
    this.init();
    let code: string[] = [];
    const exprCode = this.translateExpr(this.expr, dest, ctx);

    code.push(`let ${dest} = undefined;`, this.vars.map((elm) => `let ${elm};`).join(''));
    code.push(exprCode);
    code.push(`return ${dest};`);

    return code.join('');
  }

  private translateExpr(expr: Expression, dest: string, ctx: string): string {
    switch (expr.type) {
      case SyntaxType.STATEMENTS_EXPR:
        return this.translateStatementsExpr(expr as StatementsExpression, dest, ctx);

      case SyntaxType.PATH:
        return this.translatePath(expr as PathExpression, dest, ctx);

      case SyntaxType.COALESCING_EXPR:
        return this.translateCoalescingExpr(expr as BinaryExpression, dest, ctx);

      case SyntaxType.COMPARISON_EXPR:
        return this.translateComparisonExpr(expr as BinaryExpression, dest, ctx);

      case SyntaxType.MATH_EXPR:
        return this.translateMathExpr(expr as BinaryExpression, dest, ctx);

      case SyntaxType.LOGICAL_AND_EXPR:
        return this.translateLogicalAndExpr(expr as BinaryExpression, dest, ctx);

      case SyntaxType.LOGICAL_OR_EXPR:
        return this.translateLogicalOrExpr(expr as BinaryExpression, dest, ctx);

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
        return this.translateObjectFilterExpr(expr as FilterExpression, dest, ctx);

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

  private translatePathContext(context: ContextVariable, item: string, idx: string): string {
    const code: string[] = [];
    if (context.item) {
      code.push(`let ${context.item} = ${item};`);
    }
    if (context.index) {
      code.push(`let ${context.index} = ${idx};`);
    }
    return code.join('');
  }

  private translatePath(expr: PathExpression, dest: string, baseCtx: string): string {
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

      if (JsonTemplateTranslator.isSinglePropertySelection(part)) {
        const selector = part as SelectorExpression;
        const propStr = CommonUtils.escapeStr(selector.prop?.value);
        code.push(`if(${data}.hasOwnProperty(${propStr}) && Array.isArray(${data})){`);
        code.push(`${data} = [${data}];`);
        code.push('}');
      }
      code.push(JsonTemplateTranslator.covertToArrayValue(data));
      if (JsonTemplateTranslator.isArrayFilterExpr(part)) {
        code.push(`${data} = [${data}];`);
      }
      code.push(`for(let ${idx}=0; ${idx}<${data}.length; ${idx}++) {`);
      code.push(`${item} = ${data}[${idx}];`);
      if (i > 0 && expr.parts[i - 1].context) {
        code.push(this.translatePathContext(expr.parts[i - 1].context, item, idx));
      }
      code.push(this.translateExpr(part, item, item));
      code.push(`if(!${item}) { continue; }`);
      if (i < numParts - 1) {
        code.push(dataVars[i + 1], '=', item, ';');
      } else {
        code.push(JsonTemplateTranslator.covertToArrayValue(item));
        code.push(`${resultVar} = ${resultVar}.concat(${item});`);
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
      const valuesCode = JsonTemplateTranslator.returnObjectValues(ctx);
      code.push(`${dest} = ${valuesCode}.flat();`);
    } else {
      const propStr = CommonUtils.escapeStr(prop);
      code.push(`if(${ctx} && ${ctx}.hasOwnProperty(${propStr})){`);
      code.push(`${dest}=${ctx}[${propStr}];`);
      code.push('} else {');
      code.push(`${dest} = undefined`);
      code.push('}');
    }
    return code.join('');
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
    const propStr = CommonUtils.escapeStr(prop?.value);
    code.push(`${ctxs}=[${baseCtx}];`);
    code.push(`while(${ctxs}.length > 0) {`);
    code.push(`${currCtx} = ${ctxs}.shift();`);
    code.push(`if(!${currCtx}){continue;}`);
    code.push(`if(Array.isArray(${currCtx})){`);
    code.push(`${ctxs} = ${ctxs}.concat(${currCtx});`);
    code.push('continue;');
    code.push('}');
    code.push(`if(typeof ${currCtx} === "object") {`);
    const valuesCode = JsonTemplateTranslator.returnObjectValues(currCtx);
    code.push(`${ctxs} = ${ctxs}.concat(${valuesCode});`);
    if (prop) {
      if (prop?.value === '*') {
        code.push(`${result} = ${result}.concat(${valuesCode});`);
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
    const fnHead = expr.async ? 'async function' : 'function';
    code.push(dest, '=', fnHead, '(', (expr.params || []).join(','), '){');
    const fnTranslator = new JsonTemplateTranslator(expr.body);
    code.push(fnTranslator.translate(FUNCTION_RESULT_KEY, ctx));
    code.push('}');
    if (expr.block) {
      code.push('()');
    }
    code.push(';');
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
    const literalCode = this.translateLiteral(expr.tokenType, expr.value);
    return `${dest} = ${literalCode};`;
  }

  private getSelectorAssignmentPart(expr: SelectorExpression): string {
    if (!JsonTemplateTranslator.isValidSelectorForAssignment(expr)) {
      throw new JsosTemplateTranslatorError('Invalid assignment path');
    }
    if (expr.prop?.type === TokenType.STR) {
      return `[${CommonUtils.escapeStr(expr.prop?.value)}]`;
    } else {
      return `.${expr.prop?.value}`;
    }
  }
  private getArrayIndexAssignmentPart(
    expr: IndexFilterExpression,
    code: string[],
    ctx: string,
  ): string {
    if (expr.indexes.elements.length > 1) {
      throw new JsosTemplateTranslatorError('Invalid assignment path');
    }
    const keyVar = this.acquireVar();
    code.push(this.translateExpr(expr.indexes.elements[0], keyVar, ctx));
    this.releaseVars(keyVar);
    return `[${keyVar}]`;
  }

  private translateAssignmentExpr(expr: AssignmentExpression, dest: string, ctx: string): string {
    const code: string[] = [];
    const valueVar = this.acquireVar();
    code.push(this.translateExpr(expr.value, valueVar, ctx));
    const assignmentPathParts: string[] = [];
    const root = expr.path.root;
    if (!root || root === DATA_PARAM_KEY || typeof root === 'object') {
      throw new JsosTemplateTranslatorError('Invalid assignment path');
    }
    assignmentPathParts.push(root);
    for (let part of expr.path.parts) {
      switch (part.type) {
        case SyntaxType.SELECTOR:
          assignmentPathParts.push(this.getSelectorAssignmentPart(part as SelectorExpression));
          break;
        case SyntaxType.ARRAY_INDEX_FILTER_EXPR:
          assignmentPathParts.push(
            this.getArrayIndexAssignmentPart(part as IndexFilterExpression, code, ctx),
          );
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

  private translateCoalescingExpr(expr: BinaryExpression, dest: string, ctx: string): string {
    const val1 = this.acquireVar();
    const code: string[] = [];
    code.push(this.translateExpr(expr.args[0], val1, ctx));
    code.push(`if(${val1} !== null && ${val1} !== undefined) {`);
    code.push(`${dest} = ${val1};`);
    code.push('} else {');
    const val2 = this.acquireVar();
    code.push(this.translateExpr(expr.args[1], val2, ctx));
    code.push(`${dest} = ${val2};`);
    code.push('}');
    this.releaseVars(val1, val2);
    return code.join('');
  }

  private translateLogicalOrExpr(expr: BinaryExpression, dest: string, ctx: string): string {
    const val1 = this.acquireVar();
    const code: string[] = [];
    code.push(this.translateExpr(expr.args[0], val1, ctx));
    code.push(`if(${val1}) {`);
    code.push(`${dest} = ${val1};`);
    code.push('} else {');
    const val2 = this.acquireVar();
    code.push(this.translateExpr(expr.args[1], val2, ctx));
    code.push(`${dest} = ${val2};`);
    code.push('}');
    this.releaseVars(val1, val2);
    return code.join('');
  }

  private translateLogicalAndExpr(expr: BinaryExpression, dest: string, ctx: string): string {
    const val1 = this.acquireVar();
    const code: string[] = [];
    code.push(this.translateExpr(expr.args[0], val1, ctx));
    code.push(`if(!${val1}) {`);
    code.push(`${dest} = ${val1};`);
    code.push('} else {');
    const val2 = this.acquireVar();
    code.push(this.translateExpr(expr.args[1], val2, ctx));
    code.push(`${dest} = ${val2};`);
    code.push('}');
    this.releaseVars(val1, val2);
    return code.join('');
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

  private translateLiteral(type: TokenType, val: any): string {
    if (type === TokenType.STR) {
      return CommonUtils.escapeStr(val);
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
        code.push(dest, '= !', val, ';');
        break;

      case '-':
        code.push(dest, '= -', JsonTemplateTranslator.returnSingleValue(arg, val), ';');
        break;

      case Keyword.TYPEOF:
        code.push(dest, '= typeof ', val, ';');
        break;

      case Keyword.AWAIT:
        code.push(dest, '= await ', val, ';');
        break;
    }

    this.releaseVars(val);
    return code.join('');
  }

  private static isArrayFilterExpr(expr: Expression): boolean {
    return (
      expr.type === SyntaxType.ARRAY_INDEX_FILTER_EXPR || expr.type === SyntaxType.RANGE_FILTER_EXPR
    );
  }

  private static isValidSelectorForAssignment(expr: SelectorExpression): boolean {
    return expr.selector === '.' && !!expr.prop && expr.prop.type !== TokenType.PUNCT;
  }

  private static isSinglePropertySelection(expr: Expression): boolean {
    if (expr.type === SyntaxType.SELECTOR) {
      const part = expr as SelectorExpression;
      return part.selector === '.' && part.prop?.type === TokenType.ID;
    }
    return false;
  }

  private static returnObjectValues(varName: string): string {
    return `Object.values(${varName}).filter(v => v !== null && v !== undefined)`;
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

  private translateObjectFilterExpr(expr: FilterExpression, dest: string, ctx: string): string {
    const code: string[] = [];
    const condition = this.acquireVar();
    code.push(this.translateExpr(expr.filter, condition, ctx));
    code.push(`if(!${condition}) {${dest} = undefined;}`);
    this.releaseVars(condition);
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
      code.push(`if(${ctx}.hasOwnProperty(key)){${resultVar}[key] = ${ctx}[key];}`);
      code.push('}');
    } else {
      code.push(`${resultVar} = [];`);
      code.push(`for(let key of ${allKeys}){`);
      code.push(`if(typeof key === 'string'){`);
      code.push(`for(let childCtx of ${ctx}){`);
      code.push(`if(childCtx.hasOwnProperty(key)){`);
      code.push(`${resultVar}.push(childCtx[key]);`);
      code.push('}');
      code.push('}');
      code.push('continue;');
      code.push('}');
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
}
