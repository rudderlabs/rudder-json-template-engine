import {
  BINDINGS_CONTEXT_KEY,
  BINDINGS_PARAM_KEY,
  DATA_PARAM_KEY,
  FUNCTION_RESULT_KEY,
  RESULT_KEY,
  VARS_PREFIX,
} from './constants';
import { JsonTemplateTranslatorError } from './errors';
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
  TokenType,
  IndexFilterExpression,
  DefinitionExpression,
  SpreadExpression,
  LambdaArgExpression,
  ConditionalExpression,
  ObjectFilterExpression,
  ArrayFilterExpression,
  BlockExpression,
  PathOptions,
  PathType,
  ReturnExpression,
  ThrowExpression,
  LoopExpression,
  IncrementExpression,
  LoopControlExpression,
  Keyword,
} from './types';
import { convertToStatementsExpr, escapeStr } from './utils/common';

export class JsonTemplateTranslator {
  private vars: string[] = [];

  private lastVarId = 0;

  private unusedVars: string[] = [];

  private readonly expr: Expression;

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
    const code: string[] = [];
    const exprCode = this.translateExpr(this.expr, dest, ctx);
    code.push(`let ${dest};`);
    code.push(this.vars.map((elm) => `let ${elm};`).join(''));
    code.push(exprCode);
    code.push(`return ${dest};`);

    return code.join('');
  }

  private translateExpr(expr: Expression, dest: string, ctx: string): string {
    switch (expr.type) {
      case SyntaxType.STATEMENTS_EXPR:
        return this.translateStatementsExpr(expr as StatementsExpression, dest, ctx);

      case SyntaxType.PATH:
        return this.translatePathExpr(expr as PathExpression, dest, ctx);

      case SyntaxType.IN_EXPR:
        return this.translateINExpr(expr as BinaryExpression, dest, ctx);

      case SyntaxType.COMPARISON_EXPR:
      case SyntaxType.MATH_EXPR:
        return this.translateBinaryExpr(expr as BinaryExpression, dest, ctx);

      case SyntaxType.LOGICAL_COALESCE_EXPR:
      case SyntaxType.LOGICAL_AND_EXPR:
      case SyntaxType.LOGICAL_OR_EXPR:
        return this.translateLogicalExpr(expr as BinaryExpression, dest, ctx);

      case SyntaxType.UNARY_EXPR:
        return this.translateUnaryExpr(expr as UnaryExpression, dest, ctx);

      case SyntaxType.LAMBDA_ARG:
        return this.translateLambdaArgExpr(expr as LambdaArgExpression, dest, ctx);

      case SyntaxType.SPREAD_EXPR:
        return this.translateSpreadExpr(expr as SpreadExpression, dest, ctx);

      case SyntaxType.INCREMENT:
        return this.translateIncrementExpr(expr as IncrementExpression, dest, ctx);

      case SyntaxType.LITERAL:
        return this.translateLiteralExpr(expr as LiteralExpression, dest, ctx);

      case SyntaxType.ARRAY_EXPR:
        return this.translateArrayExpr(expr as ArrayExpression, dest, ctx);

      case SyntaxType.OBJECT_EXPR:
        return this.translateObjectExpr(expr as ObjectExpression, dest, ctx);

      case SyntaxType.BLOCK_EXPR:
        return this.translateBlockExpr(expr as BlockExpression, dest, ctx);

      case SyntaxType.LOOP_EXPR:
        return this.translateLoopExpr(expr as LoopExpression, dest, ctx);

      case SyntaxType.LOOP_CONTROL_EXPR:
        return this.translateLoopControlExpr(expr as LoopControlExpression, dest, ctx);

      case SyntaxType.FUNCTION_EXPR:
        return this.translateFunctionExpr(expr as FunctionExpression, dest, ctx);

      case SyntaxType.FUNCTION_CALL_EXPR:
        return this.translateFunctionCallExpr(expr as FunctionCallExpression, dest, ctx);

      case SyntaxType.DEFINITION_EXPR:
        return this.translateDefinitionExpr(expr as DefinitionExpression, dest, ctx);

      case SyntaxType.ASSIGNMENT_EXPR:
        return this.translateAssignmentExpr(expr as AssignmentExpression, dest, ctx);

      case SyntaxType.OBJECT_FILTER_EXPR:
        return this.translateObjectFilterExpr(expr as ObjectFilterExpression, dest, ctx);

      case SyntaxType.ARRAY_FILTER_EXPR:
        return this.translateArrayFilterExpr(expr as ArrayFilterExpression, dest, ctx);

      case SyntaxType.OBJECT_INDEX_FILTER_EXPR:
        return this.translateIndexFilterExpr(expr as IndexFilterExpression, dest, ctx);

      case SyntaxType.SELECTOR:
        return this.translateSelector(expr as SelectorExpression, dest, ctx);

      case SyntaxType.CONDITIONAL_EXPR:
        return this.translateConditionalExpr(expr as ConditionalExpression, dest, ctx);

      case SyntaxType.RETURN_EXPR:
        return this.translateReturnExpr(expr as ReturnExpression, dest, ctx);

      case SyntaxType.THROW_EXPR:
        return this.translateThrowExpr(expr as ThrowExpression, dest, ctx);
      default:
        return '';
    }
  }

  translateLoopControlExpr(expr: LoopControlExpression, _dest: string, _ctx: string): string {
    return `${expr.control};`;
  }

  translateIncrementExpr(expr: IncrementExpression, dest: string, _ctx: string): string {
    const code: string[] = [];
    let incrementCode = `${expr.op}${expr.id};`;
    if (expr.postfix) {
      incrementCode = `${expr.id}${expr.op};`;
    }
    code.push(JsonTemplateTranslator.generateAssignmentCode(dest, incrementCode));
    return code.join('');
  }

  private translateLoopExpr(expr: LoopExpression, dest: string, ctx: string): string {
    const code: string[] = [];
    const init = this.acquireVar();
    const test = this.acquireVar();
    const update = this.acquireVar();
    const body = this.acquireVar();
    const iterator = this.acquireVar();
    if (expr.init) {
      code.push(this.translateExpr(expr.init, init, ctx));
    }
    code.push(`for(let ${iterator}=0;;${iterator}++){`);
    if (expr.update) {
      code.push(`if(${iterator} > 0) {`);
      code.push(this.translateExpr(expr.update, update, ctx));
      code.push('}');
    }
    if (expr.test) {
      code.push(this.translateExpr(expr.test, test, ctx));
      code.push(`if(!${test}){break;}`);
    }
    code.push(this.translateExpr(expr.body, body, ctx));
    code.push(`}`);
    JsonTemplateTranslator.generateAssignmentCode(dest, body);
    this.releaseVars(iterator, body, update, test, init);
    return code.join('');
  }

  private translateThrowExpr(expr: ThrowExpression, _dest: string, ctx: string): string {
    const code: string[] = [];
    const value = this.acquireVar();
    code.push(this.translateExpr(expr.value, value, ctx));
    code.push(`throw ${value};`);
    this.releaseVars(value);
    return code.join('');
  }

  private translateReturnExpr(expr: ReturnExpression, _dest: string, ctx: string): string {
    const code: string[] = [];
    if (expr.value) {
      const value = this.acquireVar();
      code.push(this.translateExpr(expr.value, value, ctx));
      code.push(`return ${value};`);
      this.releaseVars(value);
    }
    code.push(`return ${ctx};`);
    return code.join('');
  }

  private translateConditionalExpr(expr: ConditionalExpression, dest: string, ctx: string): string {
    const code: string[] = [];
    const ifVar = this.acquireVar();
    code.push(this.translateExpr(expr.if, ifVar, ctx));
    code.push(`if(${ifVar}){`);
    code.push(this.translateExpr(expr.then, dest, ctx));
    code.push('} else {');
    if (expr.else) {
      code.push(this.translateExpr(expr.else, dest, ctx));
    } else {
      code.push(`${dest} = undefined;`);
    }
    code.push('}');
    this.releaseVars(ifVar);
    return code.join('');
  }

  private translateLambdaArgExpr(expr: LambdaArgExpression, dest: string, _ctx: string): string {
    return `${dest} = args[${expr.index}];`;
  }

  private translateSpreadExpr(expr: SpreadExpression, dest: string, ctx: string): string {
    return this.translateExpr(expr.value, dest, ctx);
  }

  private translatePathRoot(path: PathExpression, dest: string, ctx: string): string {
    if (typeof path.root === 'object') {
      return this.translateExpr(path.root, dest, ctx);
    }
    return `${dest} = ${path.root || ctx};`;
  }

  private translatePathContextVariables(
    expr: PathExpression,
    partNum: number,
    item: string,
    idx: string,
  ): string {
    const options = JsonTemplateTranslator.getPathOptions(expr, partNum);
    const code: string[] = [];
    if (options.item) {
      code.push(`let ${options.item} = ${item};`);
    }
    if (options.index) {
      code.push(`let ${options.index} = ${idx};`);
    }
    return code.join('');
  }

  private prepareDataForPathPart(expr: PathExpression, partNum: number, data: string): string {
    const code: string[] = [];
    code.push(JsonTemplateTranslator.covertToArrayValue(data));
    if (
      JsonTemplateTranslator.isArrayFilterExpr(expr.parts[partNum]) ||
      JsonTemplateTranslator.isToArray(expr, partNum)
    ) {
      code.push(`${data} = [${data}];`);
    }
    return code.join('');
  }

  private translatePathParts(expr: PathExpression, dest: string): string {
    if (!expr.parts.length) {
      return '';
    }
    const { parts } = expr;
    const code: string[] = [];
    const numParts = parts.length;
    const dataVars = this.acquireVars(numParts);
    const indexVars = this.acquireVars(numParts);
    const itemVars = this.acquireVars(numParts);
    const result = this.acquireVar();
    code.push(JsonTemplateTranslator.generateAssignmentCode(result, '[]'));
    code.push(JsonTemplateTranslator.generateAssignmentCode(dataVars[0], dest));
    for (let i = 0; i < numParts; i++) {
      const part = parts[i];
      const idx = indexVars[i];
      const item = itemVars[i];
      const data = dataVars[i];
      code.push(this.prepareDataForPathPart(expr, i, data));
      code.push(`for(${idx}=0; ${idx}<${data}.length; ${idx}++) {`);
      code.push(`${item} = ${data}[${idx}];`);
      code.push(this.translatePathContextVariables(expr, i, item, idx));
      code.push(this.translateExpr(part, item, item));
      code.push(`if(${JsonTemplateTranslator.returnIsEmpty(item)}) { continue; }`);
      if (i < numParts - 1) {
        code.push(JsonTemplateTranslator.generateAssignmentCode(dataVars[i + 1], item));
      } else {
        code.push(`${result}.push(${item});`);
      }
    }
    for (let i = 0; i < numParts; i++) {
      code.push('}');
    }
    this.releaseVars(...indexVars);
    this.releaseVars(...itemVars);
    this.releaseVars(...dataVars);
    this.releaseVars(result);
    if (!expr.returnAsArray) {
      code.push(JsonTemplateTranslator.convertToSingleValueIfSafe(result));
    }
    code.push(JsonTemplateTranslator.generateAssignmentCode(dest, result));
    return code.join('');
  }

  private translateSimplePathExpr(expr: PathExpression, dest: string, ctx: string): string {
    const code: string[] = [];
    let currCtx = ctx;
    if (typeof expr.root === 'object') {
      code.push(this.translateExpr(expr.root, dest, ctx));
      currCtx = dest;
    } else if (expr.root) {
      currCtx = expr.root;
    }
    const simplePath = this.translateToSimplePath(expr, code, currCtx);
    code.push(JsonTemplateTranslator.generateAssignmentCode(dest, simplePath));
    if (expr.returnAsArray) {
      code.push(JsonTemplateTranslator.covertToArrayValue(dest));
    }
    return code.join('');
  }

  private translatePathExpr(expr: PathExpression, dest: string, ctx: string): string {
    if (expr.pathType === PathType.SIMPLE) {
      return this.translateSimplePathExpr(expr, dest, ctx);
    }
    const code: string[] = [];
    code.push(this.translatePathRoot(expr, dest, ctx));
    code.push(this.translatePathParts(expr, dest));
    if (expr.returnAsArray && expr.parts.length === 0) {
      code.push(JsonTemplateTranslator.covertToArrayValue(dest));
    }
    return code.join('');
  }

  private translateCurrentSelector(expr: SelectorExpression, dest, ctx) {
    const code: string[] = [];
    const prop = expr.prop?.value;
    if (prop === '*') {
      const valuesCode = JsonTemplateTranslator.returnObjectValues(ctx);
      code.push(`${dest} = ${valuesCode}.flat();`);
    } else if (prop) {
      const propStr = escapeStr(prop);
      code.push(`if(${ctx} && Object.prototype.hasOwnProperty.call(${ctx}, ${propStr})){`);
      code.push(`${dest}=${ctx}[${propStr}];`);
      code.push('} else {');
      code.push(`${dest} = undefined;`);
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
    const code: string[] = [];
    const ctxs = this.acquireVar();
    const currCtx = this.acquireVar();
    const result = this.acquireVar();
    code.push(JsonTemplateTranslator.generateAssignmentCode(result, '[]'));
    const { prop } = expr;
    const propStr = escapeStr(prop?.value);
    code.push(`${ctxs}=[${baseCtx}];`);
    code.push(`while(${ctxs}.length > 0) {`);
    code.push(`${currCtx} = ${ctxs}.shift();`);
    code.push(`if(${JsonTemplateTranslator.returnIsEmpty(currCtx)}){continue;}`);
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
        code.push(`if(Object.prototype.hasOwnProperty.call(${currCtx}, ${propStr})){`);
        code.push(`${result} = ${result}.concat(${currCtx}[${propStr}]);`);
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

  private translateBlockExpr(expr: BlockExpression, dest: string, ctx: string): string {
    if (expr.statements.length === 1) {
      return this.translateExpr(expr.statements[0], dest, ctx);
    }
    const fnExpr: FunctionExpression = {
      type: SyntaxType.FUNCTION_EXPR,
      body: convertToStatementsExpr(...expr.statements),
      block: true,
    };
    return this.translateExpr(fnExpr, dest, ctx);
  }

  private translateFunctionExpr(expr: FunctionExpression, dest: string, ctx: string): string {
    const code: string[] = [];
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
    const code: string[] = [];
    const result = this.acquireVar();
    code.push(JsonTemplateTranslator.generateAssignmentCode(result, ctx));
    if (expr.object) {
      code.push(this.translateExpr(expr.object, result, ctx));
      code.push(`if(${JsonTemplateTranslator.returnIsNotEmpty(result)}){`);
    }
    const functionArgsStr = this.translateSpreadableExpressions(expr.args, result, code);
    code.push(result, '=', this.getFunctionName(expr, result), '(', functionArgsStr, ');');
    if (expr.object) {
      code.push('}');
    }
    code.push(JsonTemplateTranslator.generateAssignmentCode(dest, result));
    this.releaseVars(result);
    return code.join('');
  }

  private translateObjectExpr(expr: ObjectExpression, dest: string, ctx: string): string {
    const code: string[] = [];
    const propExprs: string[] = [];
    const vars: string[] = [];
    for (const prop of expr.props) {
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
    for (const item of items) {
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
    return JsonTemplateTranslator.generateAssignmentCode(dest, literalCode);
  }

  private getSimplePathSelector(expr: SelectorExpression, isAssignment: boolean): string {
    if (expr.prop?.type === TokenType.STR) {
      return `${isAssignment ? '' : '?.'}[${escapeStr(expr.prop?.value)}]`;
    }
    return `${isAssignment ? '' : '?'}.${expr.prop?.value}`;
  }

  private getSimplePathArrayIndex(
    expr: ArrayFilterExpression,
    ctx: string,
    code: string[],
    keyVars: string[],
    isAssignment: boolean,
  ): string {
    const parts: string[] = [];
    const prefix = isAssignment ? '' : '?.';
    const filter = expr.filter as IndexFilterExpression;
    const keyVar = this.acquireVar();
    code.push(this.translateExpr(filter.indexes.elements[0], keyVar, ctx));
    parts.push(`${prefix}[${keyVar}]`);
    keyVars.push(keyVar);
    return parts.join('');
  }

  private translateToSimplePath(
    expr: PathExpression,
    code: string[],
    ctx: string,
    isAssignment = false,
  ): string {
    const simplePath: string[] = [];
    simplePath.push(ctx);
    const keyVars: string[] = [];
    for (const part of expr.parts) {
      if (part.type === SyntaxType.SELECTOR) {
        simplePath.push(this.getSimplePathSelector(part as SelectorExpression, isAssignment));
      } else {
        simplePath.push(
          this.getSimplePathArrayIndex(
            part as ArrayFilterExpression,
            ctx,
            code,
            keyVars,
            isAssignment,
          ),
        );
      }
    }
    this.releaseVars(...keyVars);
    return simplePath.join('');
  }

  private translateAssignmentExpr(expr: AssignmentExpression, _dest: string, ctx: string): string {
    const code: string[] = [];
    const valueVar = this.acquireVar();
    code.push(this.translateExpr(expr.value, valueVar, ctx));
    const assignmentPath = this.translateToSimplePath(
      expr.path,
      code,
      expr.path.root as string,
      true,
    );
    JsonTemplateTranslator.ValidateAssignmentPath(assignmentPath);
    code.push(JsonTemplateTranslator.generateAssignmentCode(assignmentPath, valueVar, expr.op));
    this.releaseVars(valueVar);
    return code.join('');
  }

  private translateDefinitionVars(expr: DefinitionExpression): string {
    const vars: string[] = [expr.vars.join(',')];
    if (expr.fromObject) {
      vars.unshift('{');
      vars.push('}');
    }
    return vars.join('');
  }

  private translateDefinitionExpr(expr: DefinitionExpression, dest: string, ctx: string): string {
    const code: string[] = [];
    const value = this.acquireVar();
    code.push(this.translateExpr(expr.value, value, ctx));
    const defVars = this.translateDefinitionVars(expr);
    code.push(`${expr.definition} ${defVars}=${value};`);
    code.push(JsonTemplateTranslator.generateAssignmentCode(dest, value));
    this.releaseVars(value);
    return code.join('');
  }

  private translateStatementsExpr(expr: StatementsExpression, dest: string, ctx: string): string {
    return this.translateStatements(expr.statements, dest, ctx);
  }

  private translateStatements(statements: Expression[], dest: string, ctx: string): string {
    return statements.map((statement) => this.translateExpr(statement, dest, ctx)).join('');
  }

  private getLogicalConditionCode(type: SyntaxType, varName: string): string {
    switch (type) {
      case SyntaxType.LOGICAL_COALESCE_EXPR:
        return `${varName} !== null && ${varName} !== undefined`;
      case SyntaxType.LOGICAL_OR_EXPR:
        return varName;
      default:
        return `!${varName}`;
    }
  }

  private translateLogicalExpr(expr: BinaryExpression, dest: string, ctx: string): string {
    const val1 = this.acquireVar();
    const code: string[] = [];
    code.push(this.translateExpr(expr.args[0], val1, ctx));
    const condition = this.getLogicalConditionCode(expr.type, val1);
    code.push(`if(${condition}) {`);
    code.push(JsonTemplateTranslator.generateAssignmentCode(dest, val1));
    code.push('} else {');
    const val2 = this.acquireVar();
    code.push(this.translateExpr(expr.args[1], val2, ctx));
    code.push(JsonTemplateTranslator.generateAssignmentCode(dest, val2));
    code.push('}');
    this.releaseVars(val1, val2);
    return code.join('');
  }

  private translateINExpr(expr: BinaryExpression, dest: string, ctx: string): string {
    const code: string[] = [];
    const val1 = this.acquireVar();
    const val2 = this.acquireVar();
    const resultVar = this.acquireVar();
    code.push(this.translateExpr(expr.args[0], val1, ctx));
    code.push(this.translateExpr(expr.args[1], val2, ctx));
    code.push(`if(typeof ${val2} === 'object'){`);
    const inCode = `(Array.isArray(${val2}) ? ${val2}.includes(${val1}) : ${val1} in ${val2})`;
    code.push(JsonTemplateTranslator.generateAssignmentCode(resultVar, inCode));
    code.push('} else {');
    code.push(JsonTemplateTranslator.generateAssignmentCode(resultVar, 'false'));
    code.push('}');
    code.push(JsonTemplateTranslator.generateAssignmentCode(dest, resultVar));
    return code.join('');
  }

  private translateLiteral(type: TokenType, val: any): string {
    if (type === TokenType.STR) {
      return escapeStr(val);
    }
    if (type === TokenType.REGEXP) {
      return val;
    }
    return String(val);
  }

  private translateUnaryExpr(expr: UnaryExpression, dest: string, ctx: string): string {
    const code: string[] = [];
    const val = this.acquireVar();
    code.push(this.translateExpr(expr.arg, val, ctx));
    code.push(`${dest} = ${expr.op} ${val};`);
    this.releaseVars(val);
    return code.join('');
  }

  private translateArrayFilterExpr(expr: ArrayFilterExpression, dest: string, ctx: string): string {
    const code: string[] = [];
    if (expr.filter.type === SyntaxType.ARRAY_INDEX_FILTER_EXPR) {
      code.push(this.translateIndexFilterExpr(expr.filter as IndexFilterExpression, dest, ctx));
    } else if (expr.filter.type === SyntaxType.RANGE_FILTER_EXPR) {
      code.push(this.translateRangeFilterExpr(expr.filter as RangeFilterExpression, dest, ctx));
    }
    return code.join('');
  }

  private translateObjectFilterExpr(
    expr: ObjectFilterExpression,
    dest: string,
    ctx: string,
  ): string {
    const code: string[] = [];
    const condition = this.acquireVar();
    code.push(this.translateExpr(expr.filter, condition, ctx));
    code.push(`if(!${condition}) {${dest} = undefined;}`);
    this.releaseVars(condition);
    return code.join('');
  }

  private translateObjectIndexFilterExpr(
    ctx: string,
    allKeys: string,
    resultVar: string,
    shouldExclude?: boolean,
  ): string {
    const code: string[] = [];
    if (shouldExclude) {
      code.push(`${allKeys}=Object.keys(${ctx}).filter(key => !${allKeys}.includes(key));`);
    }
    code.push(JsonTemplateTranslator.generateAssignmentCode(resultVar, '{}'));
    code.push(`for(let key of ${allKeys}){`);
    code.push(
      `if(Object.prototype.hasOwnProperty.call(${ctx}, key)){${resultVar}[key] = ${ctx}[key];}`,
    );
    code.push('}');
    return code.join('');
  }

  private translateArrayIndexFilterExpr(ctx: string, allKeys: string, resultVar: string): string {
    const code: string[] = [];
    code.push(JsonTemplateTranslator.generateAssignmentCode(resultVar, '[]'));
    code.push(`for(let key of ${allKeys}){`);
    code.push(`if(typeof key === 'string'){`);
    code.push(`for(let childCtx of ${ctx}){`);
    code.push(`if(Object.prototype.hasOwnProperty.call(childCtx, key)){`);
    code.push(`${resultVar}.push(childCtx[key]);`);
    code.push('}');
    code.push('}');
    code.push('} else {');
    code.push(`if(key < 0){key = ${ctx}.length + key;}`);
    code.push(`if(Object.prototype.hasOwnProperty.call(${ctx}, key)){`);
    code.push(`${resultVar}.push(${ctx}[key]);`);
    code.push('}');
    code.push('}');
    code.push('}');
    code.push(`if(${allKeys}.length === 1) {${resultVar} = ${resultVar}[0];}`);
    return code.join('');
  }

  private translateIndexFilterExpr(expr: IndexFilterExpression, dest: string, ctx: string): string {
    const code: string[] = [];
    const allKeys = this.acquireVar();
    code.push(this.translateArrayExpr(expr.indexes, allKeys, ctx));
    code.push(`${allKeys} = ${allKeys}.flat();`);
    const resultVar = this.acquireVar();
    if (expr.type === SyntaxType.OBJECT_INDEX_FILTER_EXPR) {
      code.push(this.translateObjectIndexFilterExpr(ctx, allKeys, resultVar, expr.exclude));
    } else {
      code.push(this.translateArrayIndexFilterExpr(ctx, allKeys, resultVar));
    }
    code.push(JsonTemplateTranslator.generateAssignmentCode(dest, resultVar));
    this.releaseVars(allKeys);
    this.releaseVars(resultVar);
    return code.join('');
  }

  private translateRangeFilterExpr(expr: RangeFilterExpression, dest: string, ctx: string): string {
    const code: string[] = [];
    const fromIdx = this.acquireVar();
    const toIdx = this.acquireVar();
    if (expr.fromIdx) {
      if (expr.toIdx) {
        code.push(this.translateExpr(expr.fromIdx, fromIdx, ctx));
        code.push(this.translateExpr(expr.toIdx, toIdx, ctx));
        code.push(dest, '=', ctx, '.slice(', fromIdx, ',', toIdx, ');');
      } else {
        code.push(this.translateExpr(expr.fromIdx, fromIdx, ctx));
        code.push(dest, '=', ctx, '.slice(', fromIdx, ');');
      }
    } else if (expr.toIdx) {
      code.push(this.translateExpr(expr.toIdx, toIdx, ctx));
      code.push(dest, '=', ctx, '.slice(0,', toIdx, ');');
    }
    this.releaseVars(fromIdx, toIdx);
    return code.join('');
  }

  private translateBinaryExpr(expr: BinaryExpression, dest: string, ctx: string): string {
    const val1 = this.acquireVar();
    const val2 = this.acquireVar();
    const { args } = expr;
    const code: string[] = [];
    code.push(this.translateExpr(args[0], val1, ctx));
    code.push(this.translateExpr(args[1], val2, ctx));

    code.push(dest, '=', binaryOperators[expr.op](val1, val2), ';');

    this.releaseVars(val1, val2);
    return code.join('');
  }

  private static ValidateAssignmentPath(path: string) {
    if (path.startsWith(BINDINGS_PARAM_KEY) && !path.startsWith(BINDINGS_CONTEXT_KEY)) {
      throw new JsonTemplateTranslatorError(`Invalid assignment path at${path}`);
    }
  }

  private static getPathOptions(expr: PathExpression, partNum: number): PathOptions {
    return (partNum === 0 ? expr.options : expr.parts[partNum - 1]?.options) || {};
  }

  private static isToArray(expr: PathExpression, partNum: number): boolean {
    return this.getPathOptions(expr, partNum).toArray === true;
  }

  private static isArrayFilterExpr(expr: Expression): boolean {
    return expr.type === SyntaxType.ARRAY_FILTER_EXPR;
  }

  private static returnIsEmpty(varName: string): string {
    return `${varName} === null || ${varName} === undefined`;
  }

  private static returnIsNotEmpty(varName: string): string {
    return `${varName} !== null && ${varName} !== undefined`;
  }

  private static returnObjectValues(varName: string): string {
    return `Object.values(${varName}).filter(v => v !== null && v !== undefined)`;
  }

  private static convertToSingleValueIfSafe(varName: string): string {
    return `${varName} = ${varName}.length < 2 ? ${varName}[0] : ${varName};`;
  }

  private static covertToArrayValue(varName: string): string {
    const code: string[] = [];
    code.push(`if(${JsonTemplateTranslator.returnIsNotEmpty(varName)}){`);
    code.push(`${varName} = Array.isArray(${varName}) ? ${varName} : [${varName}];`);
    code.push('}');
    return code.join('');
  }

  private static generateAssignmentCode(key: string, val: string, op: string = '='): string {
    return `${key}${op}${val};`;
  }
}
