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
  SelectorExpression,
  StatementsExpression,
  SyntaxType,
  TokenType,
  UnaryExpression,
  ObjectFilterExpression,
  RangeFilterExpression,
  Keyword,
  Token,
  IndexFilterExpression,
  DefinitionExpression,
  SpreadExpression,
  ObjectPropExpression,
  ToArrayExpression,
  ContextVariable
} from './types';
import { JsosTemplateParserError } from './errors';
import { DATA_PARAM_KEY } from './constants';
import { JsonTemplateLexer } from './lexer';
import { CommonUtils } from './utils';

const EMPTY_EXPR = { type: SyntaxType.EMPTY };
export class JsonTemplateParser {
  private lexer: JsonTemplateLexer;
  private expr?: Expression;

  constructor(lexer: JsonTemplateLexer) {
    this.lexer = lexer;
  }

  parse(): Expression {
    if (!this.expr) {
      const expr = this.parseStatementsExpr();
      this.lexer.validateNoMoreTokensLeft();
      this.expr = expr;
    }
    return this.expr;
  }

  private parseStatements(blockEnd?: string): Expression[] {
    let statements: Expression[] = [this.parseStatementExpr()];
    while (!this.lexer.matchTokenType(TokenType.EOT) &&
      !this.lexer.match(blockEnd)) {
      this.lexer.expect(';');
      statements.push(this.parseStatementExpr());
    }
    return statements;
  }

  private parseStatementsExpr(): StatementsExpression {
    return {
      type: SyntaxType.STATEMENTS_EXPR,
      statements: this.parseStatements()
    };
  }

  private parseStatementExpr(): Expression {
    return this.parseAssignmentExpr();
  }

  private parseAssignmentExpr(): AssignmentExpression | Expression {
    const expr = this.parseLogicalORExpr();
    if (expr.type === SyntaxType.PATH && this.lexer.match('=')) {
      this.lexer.lex();
      return {
        type: SyntaxType.ASSIGNMENT_EXPR,
        value: this.parseLogicalORExpr(),
        path: expr as PathExpression,
      };
    }
    return expr;
  }

  private parsePathPart(): Expression | undefined {
    if (this.lexer.match('.') && this.lexer.match('(', 1)) {
      this.lexer.lex();
      return this.parseBlockExpr();
    } else if (this.lexer.match('(')) {
      return this.parseFunctionCallExpr();
    } else if (this.lexer.matchPathPartSelector()) {
      return this.parseSelector();
    } else if (this.lexer.match('[') && !this.lexer.match(']', 1)) {
      return this.parseArrayFilterExpr();
    } else if (this.lexer.match('{')) {
      return this.parseObjectFiltersExpr();
    }
  }

  private parsePathParts(): Expression[] {
    let parts: Expression[] = [];
    let part: Expression | undefined;
    while ((part = this.parsePathPart())) {
      parts.push(part);
      if (part.type === SyntaxType.FUNCTION_CALL_EXPR) {
        break;
      }
    }
    return this.combinePathParts(parts);
  }

  private prependFunctionID(prefix: string, id?: string): string {
    return id ? prefix + '.' + id : prefix;
  }

  private combinePathParts(parts: Expression[]): Expression[] {
    if (parts.length < 2) {
      return parts;
    }
    let newParts: Expression[] = [];
    for (let i = 0; i < parts.length; i++) {
      let expr = parts[i];
      if (parts[i].type === SyntaxType.SELECTOR) {
        const selectorExpr = parts[i] as SelectorExpression;
        if (
          selectorExpr.selector === '.' &&
          !selectorExpr.contextVar &&
          selectorExpr.prop?.type === TokenType.ID &&
          parts[i + 1]?.type === SyntaxType.FUNCTION_CALL_EXPR
        ) {
          expr = parts[i + 1] as FunctionCallExpression;
          expr.id = this.prependFunctionID(selectorExpr.prop.value, expr.id)
          expr.dot = true;
          i++;
        }
      }
      newParts.push(expr);
    }
    if (newParts.length < parts.length) {
      newParts = this.combinePathParts(newParts);
    }
    return newParts;
  }

  private convertToFunctionCallExpr(expr: PathExpression): FunctionCallExpression | PathExpression {
    if (expr.parts[0]?.type === SyntaxType.FUNCTION_CALL_EXPR && typeof expr.root !== "object") {
      const fnExpr = expr.parts.shift() as FunctionCallExpression;
      if (expr.root) {
        fnExpr.id = this.prependFunctionID(expr.root, fnExpr.id);
        fnExpr.dot = false;
      }
      return fnExpr;
    }
    if (CommonUtils.getLastElement(expr.parts)?.type === SyntaxType.FUNCTION_CALL_EXPR) {
      const fnExpr = expr.parts.pop() as FunctionCallExpression;
      fnExpr.object = expr;
      return fnExpr;
    }
    return expr;
  }

  private parsePathRoot(root?: Expression): Expression | string | undefined {
    if (root) {
      return root;
    }
    let newRoot: Expression | string | undefined;
    if (this.lexer.match('^')) {
      this.lexer.lex();
      newRoot = DATA_PARAM_KEY;
    } else if (this.lexer.matchID()) {
      newRoot = this.lexer.value();
    }
    return newRoot;
  }
  
  private parsePath(root?: Expression): PathExpression | FunctionCallExpression {
    if (!root && !this.lexer.matchPath()) {
      this.lexer.throwUnexpectedToken();
    }

    return this.convertToFunctionCallExpr({
      type: SyntaxType.PATH,
      root: this.parsePathRoot(root),
      parts: this.parsePathParts(),
    });
  }

  private parseContextVariable(expected: string): string | undefined {
    if (this.lexer.match(expected)) {
      this.lexer.lex();
      if (!this.lexer.matchID()) {
        this.lexer.throwUnexpectedToken();
      }
      return this.lexer.value();
    }
  }

  private parseSelector(): SelectorExpression | Expression {
    let selector = this.lexer.value();
    if(selector === '%') {
      return {
        type: SyntaxType.SELECTOR,
        selector: selector,
      }
    }
    if(this.lexer.match('%')) {
      throw this.lexer.throwUnexpectedToken();
    }
    let prop: Token | undefined;
    let context: ContextVariable | undefined;
    if (this.lexer.match('*')) {
      prop = this.lexer.lex();
    }
    if (this.lexer.matchID() || this.lexer.matchTokenType(TokenType.STR)) {
      prop = this.lexer.lex();
      while(this.lexer.match('@') || this.lexer.match('#')) {
        context = context || {};
        context.item = context.item || this.parseContextVariable('@');
        context.index = context.index || this.parseContextVariable('#');
      }
    }
    return {
      type: SyntaxType.SELECTOR,
      selector: selector,
      prop,
      context
    };
  }

  private parsePositionFilterExpr(): RangeFilterExpression | IndexFilterExpression | Expression {
    if (this.lexer.match(':')) {
      this.lexer.lex();
      return {
        type: SyntaxType.RANGE_FILTER_EXPR,
        toIdx: this.parseLogicalORExpr(),
      };
    }

    let fromExpr = this.parseLogicalORExpr();
    if (this.lexer.match(':')) {
      this.lexer.lex();
      if (this.lexer.match(']')) {
        return {
          type: SyntaxType.RANGE_FILTER_EXPR,
          fromIdx: fromExpr,
        };
      }

      return {
        type: SyntaxType.RANGE_FILTER_EXPR,
        fromIdx: fromExpr,
        toIdx: this.parseLogicalORExpr(),
      };
    }

    if(!this.lexer.match(']')) {
      this.lexer.expect(',');
    }
    return {
      type: SyntaxType.ARRAY_INDEX_FILTER_EXPR,
      indexes: {
        type: SyntaxType.ARRAY_EXPR,
        elements: [fromExpr, ...this.parseCommaSeparatedElements(']', () => this.parseSpreadExpr())],
      }
    };
  }

  private parseObjectFilterExpr(): IndexFilterExpression | Expression {
    let exclude = false;
    if (this.lexer.match('~')) {
      this.lexer.lex();
      exclude = true;
    }
    // excluding is applicaple only for index filters
    if (exclude || this.lexer.match('[')) {
      return {
        type: SyntaxType.OBJECT_INDEX_FILTER_EXPR,
        indexes: this.parseArrayExpr(),
        exclude
      };
    }
    return this.parseLogicalORExpr();
  }

  private parseObjectFiltersExpr(): ObjectFilterExpression {
    const filters: Expression[] = [];
    while (this.lexer.match('{')) {
      this.lexer.expect('{');
      filters.push(this.parseObjectFilterExpr());
      this.lexer.expect('}');
    }

    return {
      type: SyntaxType.OBJECT_FILTER_EXPR,
      filters,
    };
  }

  private parseArrayFilterExpr(): Expression {
    this.lexer.expect('[');
    const expr = this.parsePositionFilterExpr();
    this.lexer.expect(']');
    return expr;
  }

  private parseLogicalORExpr(): BinaryExpression | Expression {
    let expr = this.parseLogicalANDExpr();

    while (this.lexer.match('||')) {
      expr = {
        type: SyntaxType.LOGICAL_EXPR,
        op: this.lexer.value(),
        args: [expr, this.parseLogicalANDExpr()],
      };
    }

    return expr;
  }

  private parseLogicalANDExpr(): BinaryExpression | Expression {
    let expr = this.parseEqualityExpr();

    while (this.lexer.match('&&')) {
      expr = {
        type: SyntaxType.LOGICAL_EXPR,
        op: this.lexer.value(),
        args: [expr, this.parseEqualityExpr()],
      };
    }

    return expr;
  }

  private parseEqualityExpr(): BinaryExpression | Expression {
    let expr = this.parseRelationalExpr();

    while (
      this.lexer.match('==') ||
      this.lexer.match('!=') ||
      this.lexer.match('===') ||
      this.lexer.match('!==') ||
      this.lexer.match('^==') ||
      this.lexer.match('==^') ||
      this.lexer.match('^=') ||
      this.lexer.match('=^') ||
      this.lexer.match('$==') ||
      this.lexer.match('==$') ||
      this.lexer.match('$=') ||
      this.lexer.match('=$') ||
      this.lexer.match('*==') ||
      this.lexer.match('==*') ||
      this.lexer.match('*=') ||
      this.lexer.match('=*')
    ) {
      expr = {
        type: SyntaxType.COMPARISON_EXPR,
        op: this.lexer.value(),
        args: [expr, this.parseRelationalExpr()],
      };
    }

    return expr;
  }

  private parseRelationalExpr(): BinaryExpression | Expression {
    let expr = this.parseShiftExpr();

    while (
      this.lexer.match('<') ||
      this.lexer.match('>') ||
      this.lexer.match('<=') ||
      this.lexer.match('>=')
    ) {
      expr = {
        type: SyntaxType.COMPARISON_EXPR,
        op: this.lexer.value(),
        args: [expr, this.parseShiftExpr()],
      };
    }

    return expr;
  }

  private parseShiftExpr(): BinaryExpression | Expression {
    let expr = this.parseAdditiveExpr();

    while (this.lexer.match('>>') || this.lexer.match('<<')) {
      expr = {
        type: SyntaxType.MATH_EXPR,
        op: this.lexer.value(),
        args: [expr, this.parseAdditiveExpr()],
      };
    }

    return expr;
  }

  private parseAdditiveExpr(): BinaryExpression | Expression {
    let expr = this.parseMultiplicativeExpr();

    while (this.lexer.match('+') || this.lexer.match('-')) {
      expr = {
        type: SyntaxType.MATH_EXPR,
        op: this.lexer.value(),
        args: [expr, this.parseMultiplicativeExpr()],
      };
    }

    return expr;
  }

  private parseMultiplicativeExpr(): BinaryExpression | Expression {
    let expr: Expression = this.parsePowerExpr();

    while (this.lexer.match('*') || this.lexer.match('/') || this.lexer.match('%')) {
      expr = {
        type: SyntaxType.MATH_EXPR,
        op: this.lexer.value() as string,
        args: [expr, this.parsePowerExpr()],
      };
    }

    return expr;
  }

  private parsePowerExpr(): BinaryExpression | Expression {
    let expr: Expression = this.parseUnaryExpr();

    while (this.lexer.match('**')) {
      expr = {
        type: SyntaxType.MATH_EXPR,
        op: this.lexer.value() as string,
        args: [expr, this.parsePowerExpr()],
      };
    }

    return expr;
  }

  private parseUnaryExpr(): UnaryExpression | Expression {
    if (this.lexer.match('!') || this.lexer.match('-') || this.lexer.matchTypeOf()) {
      return {
        type: SyntaxType.UNARY_EXPR,
        op: this.lexer.value() as string,
        arg: this.parsePathAfterExpr(),
      };
    }

    return this.parsePathAfterExpr();
  }

  private isToArrayExpr(): boolean {
    let toArray = false;
    while (this.lexer.match('[') && this.lexer.match(']', 1)) {
      this.lexer.lex();
      this.lexer.lex();
      toArray = true;
    }
    return toArray;
  }

  private parsePathAfterExpr(): PathExpression | ToArrayExpression | Expression {
    let expr = this.parsePrimaryExpr();
    while (this.lexer.matchPathPartSelector() || this.lexer.match('[') || this.lexer.match('(')) {
      if (this.isToArrayExpr()) {
        expr = {
          type: SyntaxType.TO_ARRAY_EXPR,
          value: expr
        }
        continue;
      }
      expr = this.parsePath(expr);
    }
    return expr;
  }

  private parseLiteralExpr(): LiteralExpression {
    const token = this.lexer.lex();
    return {
      type: SyntaxType.LITERAL,
      value: token.value,
      tokenType: token.type,
    };
  }

  private parseIDPath(): string {
    const idParts: string[] = [];
    while (this.lexer.matchID()) {
      idParts.push(this.lexer.value());
      if (this.lexer.match('.') && this.lexer.matchID(1)) {
        this.lexer.lex();
      }
    }
    if (!idParts.length) {
      this.lexer.throwUnexpectedToken();
    }
    return idParts.join('.');
  }

  private parseObjectDefVars(): string[] {
    const vars: string[] = [];
    this.lexer.expect('{');
    while (!this.lexer.match('}')) {
      if (!this.lexer.matchID()) {
        throw new JsosTemplateParserError('Invalid object vars at ' + this.lexer.getContext());
      }
      vars.push(this.lexer.value());
      if (!this.lexer.match('}')) {
        this.lexer.expect(',');
      }
    }
    this.lexer.expect('}');
    if (vars.length === 0) {
      throw new JsosTemplateParserError('Empty object vars at ' + this.lexer.getContext());
    }
    return vars;
  }

  private parseNormalDefVars(): string[] {
    const vars: string[] = [];
    if (!this.lexer.matchID()) {
      throw new JsosTemplateParserError('Invalid normal vars at ' + this.lexer.getContext());
    }
    vars.push(this.lexer.value());
    return vars;
  }

  private parseDefinitionExpr(): DefinitionExpression {
    const definition = this.lexer.value();
    let fromObject = this.lexer.match('{');
    let vars: string[] = fromObject ? this.parseObjectDefVars() : this.parseNormalDefVars();
    this.lexer.expect('=');

    return {
      type: SyntaxType.DEFINTION_EXPR,
      value: this.parseLogicalORExpr(),
      vars,
      definition,
      fromObject
    };
  }

  private parseFunctionCallArgs(): Expression[] {
    this.lexer.expect('(');
    const args = this.parseCommaSeparatedElements(')', () => this.parseSpreadExpr())
    this.lexer.expect(')');
    return args;
  }

  private parseFunctionCallExpr(): FunctionCallExpression {
    let id: string | undefined;

    if (this.lexer.matchNew()) {
      this.lexer.lex();
      if (!this.lexer.matchID()) {
        this.lexer.throwUnexpectedToken();
      }
      id = 'new ' + this.parseIDPath();
    }

    return {
      type: SyntaxType.FUNCTION_CALL_EXPR,
      args: this.parseFunctionCallArgs(),
      id,
    };
  }

  private parseFunctionDefinitionParam(): string {
    let spread: string = '';
    if (this.lexer.matchSpread()) {
      this.lexer.lex();
      spread = '...';
      // rest param should be last param.
      if (!this.lexer.match(')', 1)) {
        this.lexer.throwUnexpectedToken();
      }
    }
    if (!this.lexer.matchID()) {
      this.lexer.throwUnexpectedToken();
    }
    return `${spread}${this.lexer.value()}`;
  }

  private parseFunctionDefinitionParams(): string[] {
    this.lexer.expect('(');
    const params = this.parseCommaSeparatedElements(')', () => this.parseFunctionDefinitionParam());
    this.lexer.expect(')');
    return params;
  }

  private parseFunctionDefinitionExpr(): FunctionExpression {
    this.lexer.expectKeyword(Keyword.FUNCTION);
    const params = this.parseFunctionDefinitionParams();
    this.lexer.expect('{');
    const statements = this.parseStatements('}');
    this.lexer.expect('}');
    return {
      type: SyntaxType.FUNCTION_EXPR,
      params,
      statements,
    };
  }

  private parseObjectKeyExpr(): Expression | string {
    let key: Expression | string;
    if (this.lexer.match('[')) {
      this.lexer.lex();
      key = this.parseLogicalORExpr();
      this.lexer.expect(']');
    } else if (this.lexer.matchID()) {
      key = this.lexer.value();
    } else if (this.lexer.matchTokenType(TokenType.STR)) {
      key = this.parseLiteralExpr();
    } else {
      this.lexer.throwUnexpectedToken();
    }
    return key;
  }

  private parseObjectPropExpr(): ObjectPropExpression {
    let key: Expression | string | undefined;
    if (!this.lexer.matchSpread()) {
      key = this.parseObjectKeyExpr();
      this.lexer.expect(':');
    }
    const value = this.parseSpreadExpr();
    return {
      type: SyntaxType.OBJECT_PROP_EXPR,
      key,
      value
    }
  }

  private parseObjectExpr(): ObjectExpression {
    this.lexer.expect('{');
    const props = this.parseCommaSeparatedElements('}', () => this.parseObjectPropExpr());
    this.lexer.expect('}');
    return {
      type: SyntaxType.OBJECT_EXPR,
      props
    };
  }

  private parseCommaSeparatedElements<T>(blockEnd: string, parseFn: () => T): T[] {
    const elements: T[] = [];
    while (!this.lexer.match(blockEnd)) {
      elements.push(parseFn());
      if (!this.lexer.match(blockEnd)) {
        this.lexer.expect(',');
      }
    }
    return elements;
  }

  private parseSpreadExpr(): SpreadExpression | Expression {
    if (this.lexer.matchSpread()) {
      this.lexer.lex();
      return {
        type: SyntaxType.SPREAD_EXPR,
        value: this.parseLogicalORExpr()
      }
    }
    return this.parseLogicalORExpr();
  }

  private parseArrayExpr(): ArrayExpression {
    this.lexer.expect('[');
    const elements = this.parseCommaSeparatedElements(']', () => this.parseSpreadExpr());
    this.lexer.expect(']');
    return {
      type: SyntaxType.ARRAY_EXPR,
      elements
    };
  }

  private parseBlockExpr(): FunctionExpression | Expression {
    this.lexer.expect('(');
    let statements: Expression[] = this.parseStatements(')');
    this.lexer.expect(')');
    if (statements.length === 0) {
      throw new JsosTemplateParserError('Empty block detected at ' + this.lexer.getContext());
    }
    return statements.length === 1
      ? statements[0]
      : {
        type: SyntaxType.FUNCTION_EXPR,
        statements,
        block: true,
      };
  }

  private parseLambdaExpr(): FunctionExpression {
    this.lexer.expectKeyword(Keyword.LAMBDA);
    const expr = this.parseLogicalORExpr();
    return {
      type: SyntaxType.FUNCTION_EXPR,
      statements: [expr],
      params: ['...args']
    }
  }

  private parsePrimaryExpr(): Expression {
    if (this.lexer.matchEOT() || this.lexer.match(';')) {
      return EMPTY_EXPR;
    }

    if (this.lexer.matchTokenType(TokenType.LAMBDA_ARG)) {
      return {
        type: SyntaxType.LAMBDA_ARG,
        index: this.lexer.value()
      }
    }

    if (this.lexer.matchNew()) {
      return this.parseFunctionCallExpr();
    }

    if (this.lexer.matchDefinition()) {
      return this.parseDefinitionExpr();
    }

    if (this.lexer.matchLambda()) {
      return this.parseLambdaExpr();
    }

    if (this.lexer.matchFunction()) {
      return this.parseFunctionDefinitionExpr();
    }

    if (this.lexer.matchLiteral()) {
      return this.parseLiteralExpr();
    }

    if (this.lexer.match('{')) {
      return this.parseObjectExpr();
    }

    if (this.lexer.match('[')) {
      return this.parseArrayExpr();
    }

    if (this.lexer.matchPath()) {
      return this.parsePath();
    }

    if (this.lexer.match('(')) {
      return this.parseBlockExpr();
    }

    return this.lexer.throwUnexpectedToken();
  }
}
