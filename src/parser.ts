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
  FilterExpression,
  RangeFilterExpression,
  Token,
  IndexFilterExpression,
  DefinitionExpression,
  SpreadExpression,
  ObjectPropExpression,
  ToArrayExpression,
  ContextVariable,
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
    this.lexer.init();
    return this.parseStatementsExpr();
  }

  private parseEndOfStatement(blockEnd) {
    if (this.lexer.matchEOT() || this.lexer.match(blockEnd)) {
      return;
    }

    if (this.lexer.match(';')) {
      this.lexer.lex();
    } else if (this.lexer.matchNextChar('\n')) {
      this.lexer.ignoreNextChar();
    } else {
      this.lexer.throwUnexpectedToken();
    }
  }

  private parseStatements(blockEnd?: string): Expression[] {
    let statements: Expression[] = [];
    while (!this.lexer.matchEOT() && !this.lexer.match(blockEnd)) {
      statements.push(this.parseStatementExpr());
      this.parseEndOfStatement(blockEnd);
    }
    return statements;
  }

  private parseStatementsExpr(blockEnd?: string): StatementsExpression {
    return {
      type: SyntaxType.STATEMENTS_EXPR,
      statements: this.parseStatements(blockEnd),
    };
  }

  private parseStatementExpr(): Expression {
    return this.parseAssignmentExpr();
  }

  private parseAssignmentExpr(): AssignmentExpression | Expression {
    const expr = this.parseBaseExpr();
    if (expr.type === SyntaxType.PATH && this.lexer.match('=')) {
      this.lexer.lex();
      return {
        type: SyntaxType.ASSIGNMENT_EXPR,
        value: this.parseBaseExpr(),
        path: expr as PathExpression,
      };
    }
    return expr;
  }

  private parseBaseExpr(): Expression {
    return this.parseCoalescingExpr();
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
      return this.parseArrayFiltersExpr();
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
    return JsonTemplateParser.combinePathParts(parts);
  }

  private static prependFunctionID(prefix: string, id?: string): string {
    return id ? prefix + '.' + id : prefix;
  }

  private static combinePathParts(parts: Expression[]): Expression[] {
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
          expr.id = this.prependFunctionID(selectorExpr.prop.value, expr.id);
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

  private static convertToFunctionCallExpr(expr: PathExpression): FunctionCallExpression | PathExpression | FunctionExpression {
    if (expr.parts[0]?.type === SyntaxType.FUNCTION_CALL_EXPR && typeof expr.root !== 'object') {
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
    if (this.lexer.match('^')) {
      this.lexer.lex();
      return DATA_PARAM_KEY;
    } else if (this.lexer.matchID()) {
      return this.lexer.value();
    }
  }

  private parsePath(root?: Expression): PathExpression | FunctionCallExpression | FunctionExpression {
    const pathExpr = {
      type: SyntaxType.PATH,
      root: this.parsePathRoot(root),
      parts: this.parsePathParts(),
    };
    const shouldConvertAsBlock = JsonTemplateParser.pathContainsVariables(pathExpr);
    const expr = JsonTemplateParser.convertToFunctionCallExpr(pathExpr);
    return shouldConvertAsBlock? JsonTemplateParser.convertToBlockExpr(expr): expr;
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
    let prop: Token | undefined;
    let context: ContextVariable | undefined;
    if (this.lexer.match('*')) {
      prop = this.lexer.lex();
    }
    if (this.lexer.matchID() || this.lexer.matchTokenType(TokenType.STR)) {
      prop = this.lexer.lex();
      while (this.lexer.match('@') || this.lexer.match('#')) {
        context = context || {};
        context.item = context.item || this.parseContextVariable('@');
        context.index = context.index || this.parseContextVariable('#');
      }
    }
    return {
      type: SyntaxType.SELECTOR,
      selector: selector,
      prop,
      context,
    };
  }

  private parsePositionFilterExpr():
    | RangeFilterExpression
    | IndexFilterExpression
    | FilterExpression {
    if (this.lexer.match(':')) {
      this.lexer.lex();
      return {
        type: SyntaxType.RANGE_FILTER_EXPR,
        toIdx: this.parseBaseExpr(),
      };
    }

    let fromExpr = this.parseBaseExpr();
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
        toIdx: this.parseBaseExpr(),
      };
    }

    if (!this.lexer.match(']')) {
      this.lexer.expect(',');
    }
    return {
      type: SyntaxType.ARRAY_INDEX_FILTER_EXPR,
      indexes: {
        type: SyntaxType.ARRAY_EXPR,
        elements: [
          fromExpr,
          ...this.parseCommaSeparatedElements(']', () => this.parseSpreadExpr()),
        ],
      },
    };
  }

  private parseObjectFilterExpr(): IndexFilterExpression | FilterExpression {
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
        exclude,
      };
    }
    return {
      type: SyntaxType.OBJECT_FILTER_EXPR,
      filter: this.parseBaseExpr(),
    };
  }

  private parseObjectFiltersExpr(): IndexFilterExpression | FilterExpression {
    this.lexer.expect('{');
    const expr = this.parseObjectFilterExpr();
    this.lexer.expect('}');
    return expr;
  }

  private parseArrayFiltersExpr():
    | RangeFilterExpression
    | IndexFilterExpression
    | FilterExpression {
    this.lexer.expect('[');
    const expr = this.parsePositionFilterExpr();
    this.lexer.expect(']');
    return expr;
  }

  private parseCoalescingExpr(): BinaryExpression | Expression {
    let expr = this.parseLogicalORExpr();

    if (this.lexer.match('??')) {
      return {
        type: SyntaxType.COALESCING_EXPR,
        op: this.lexer.value(),
        args: [expr, this.parseCoalescingExpr()],
      };
    }

    return expr;
  }
  private parseLogicalORExpr(): BinaryExpression | Expression {
    let expr = this.parseLogicalANDExpr();

    if (this.lexer.match('||')) {
      return {
        type: SyntaxType.LOGICAL_OR_EXPR,
        op: this.lexer.value(),
        args: [expr, this.parseLogicalORExpr()],
      };
    }

    return expr;
  }

  private parseLogicalANDExpr(): BinaryExpression | Expression {
    let expr = this.parseEqualityExpr();

    if (this.lexer.match('&&')) {
      return {
        type: SyntaxType.LOGICAL_AND_EXPR,
        op: this.lexer.value(),
        args: [expr, this.parseLogicalANDExpr()],
      };
    }

    return expr;
  }

  private parseEqualityExpr(): BinaryExpression | Expression {
    let expr = this.parseRelationalExpr();

    if (
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
      return {
        type: SyntaxType.COMPARISON_EXPR,
        op: this.lexer.value(),
        args: [expr, this.parseEqualityExpr()],
      };
    }

    return expr;
  }

  private parseRelationalExpr(): BinaryExpression | Expression {
    let expr = this.parseShiftExpr();

    if (
      this.lexer.match('<') ||
      this.lexer.match('>') ||
      this.lexer.match('<=') ||
      this.lexer.match('>=')
    ) {
      return {
        type: SyntaxType.COMPARISON_EXPR,
        op: this.lexer.value(),
        args: [expr, this.parseRelationalExpr()],
      };
    }

    return expr;
  }

  private parseShiftExpr(): BinaryExpression | Expression {
    let expr = this.parseAdditiveExpr();

    if (this.lexer.match('>>') || this.lexer.match('<<')) {
      return {
        type: SyntaxType.MATH_EXPR,
        op: this.lexer.value(),
        args: [expr, this.parseShiftExpr()],
      };
    }

    return expr;
  }

  private parseAdditiveExpr(): BinaryExpression | Expression {
    let expr = this.parseMultiplicativeExpr();

    if (this.lexer.match('+') || this.lexer.match('-')) {
      return {
        type: SyntaxType.MATH_EXPR,
        op: this.lexer.value(),
        args: [expr, this.parseAdditiveExpr()],
      };
    }

    return expr;
  }

  private parseMultiplicativeExpr(): BinaryExpression | Expression {
    let expr: Expression = this.parsePowerExpr();

    if (this.lexer.match('*') || this.lexer.match('/') || this.lexer.match('%')) {
      return {
        type: SyntaxType.MATH_EXPR,
        op: this.lexer.value() as string,
        args: [expr, this.parseMultiplicativeExpr()],
      };
    }

    return expr;
  }

  private parsePowerExpr(): BinaryExpression | Expression {
    let expr: Expression = this.parseUnaryExpr();

    if (this.lexer.match('**')) {
      return {
        type: SyntaxType.MATH_EXPR,
        op: this.lexer.value() as string,
        args: [expr, this.parsePowerExpr()],
      };
    }

    return expr;
  }

  private parseUnaryExpr(): UnaryExpression | Expression {
    if (
      this.lexer.match('!') ||
      this.lexer.match('-') ||
      this.lexer.matchTypeOf() ||
      this.lexer.matchAwait()
    ) {
      return {
        type: SyntaxType.UNARY_EXPR,
        op: this.lexer.value() as string,
        arg: this.parseUnaryExpr(),
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

  private shouldSkipPathParsing(expr: Expression): boolean {
    switch (expr.type) {
      case SyntaxType.DEFINTION_EXPR:
      case SyntaxType.ASSIGNMENT_EXPR:
      case SyntaxType.SPREAD_EXPR:
        return true;
      case SyntaxType.LITERAL:
      case SyntaxType.MATH_EXPR:
      case SyntaxType.COMPARISON_EXPR:
        if (this.lexer.match('(')) {
          return true;
        }
        break;
      case SyntaxType.FUNCTION_EXPR:
        if (!this.lexer.match('(')) {
          return true;
        }
        break;
      case SyntaxType.ARRAY_EXPR:
      case SyntaxType.OBJECT_EXPR:
        if (this.lexer.match('(')) {
          return true;
        }
        break;
    }
    return false;
  }

  private parsePathAfterExpr(): PathExpression | ToArrayExpression | Expression {
    let expr = this.parsePrimaryExpr();
    if (this.shouldSkipPathParsing(expr)) {
      return expr;
    }
    while (this.lexer.matchPathPartSelector() || this.lexer.match('[') || this.lexer.match('(')) {
      if (this.isToArrayExpr()) {
        expr = {
          type: SyntaxType.TO_ARRAY_EXPR,
          value: expr,
        };
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
      value: this.parseBaseExpr(),
      vars,
      definition,
      fromObject,
    };
  }

  private parseFunctionCallArgs(): Expression[] {
    this.lexer.expect('(');
    const args = this.parseCommaSeparatedElements(')', () => this.parseSpreadExpr());
    this.lexer.expect(')');
    return args;
  }

  private parseFunctionCallExpr(): FunctionCallExpression {
    let id: string | undefined;

    if (this.lexer.matchNew()) {
      this.lexer.lex();
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

  private parseFunctionExpr(asyncFn = false): FunctionExpression {
    this.lexer.lex();
    const params = this.parseFunctionDefinitionParams();
    this.lexer.expect('{');
    const statements = this.parseStatementsExpr('}');
    this.lexer.expect('}');
    return {
      type: SyntaxType.FUNCTION_EXPR,
      params,
      body: statements,
      async: asyncFn,
    };
  }

  private parseObjectKeyExpr(): Expression | string {
    let key: Expression | string;
    if (this.lexer.match('[')) {
      this.lexer.lex();
      key = this.parseBaseExpr();
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
      value,
    };
  }

  private parseObjectExpr(): ObjectExpression {
    this.lexer.expect('{');
    const props = this.parseCommaSeparatedElements('}', () => this.parseObjectPropExpr());
    this.lexer.expect('}');
    return {
      type: SyntaxType.OBJECT_EXPR,
      props,
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
        value: this.parseBaseExpr(),
      };
    }
    return this.parseBaseExpr();
  }

  private parseArrayExpr(): ArrayExpression {
    this.lexer.expect('[');
    const elements = this.parseCommaSeparatedElements(']', () => this.parseSpreadExpr());
    this.lexer.expect(']');
    return {
      type: SyntaxType.ARRAY_EXPR,
      elements,
    };
  }

  private parseBlockExpr(): FunctionExpression | Expression {
    this.lexer.expect('(');
    let statements: Expression[] = this.parseStatements(')');
    this.lexer.expect(')');
    if (statements.length === 0) {
      return EMPTY_EXPR;
    } else if (statements.length === 1) {
      return statements[0];
    }
    return {
      type: SyntaxType.FUNCTION_EXPR,
      body: CommonUtils.convertToStatementsExpr(...statements),
      block: true,
    };
  }

  private parseAsyncFunctionExpr(): FunctionExpression {
    this.lexer.lex();
    if (this.lexer.matchFunction()) {
      return this.parseFunctionExpr(true);
    } else if (this.lexer.matchLambda()) {
      return this.parseLambdaExpr(true);
    }
    this.lexer.throwUnexpectedToken();
  }

  private parseLambdaExpr(asyncFn = false): FunctionExpression {
    this.lexer.lex();
    const expr = this.parseBaseExpr();
    return {
      type: SyntaxType.FUNCTION_EXPR,
      body: CommonUtils.convertToStatementsExpr(expr),
      params: ['...args'],
      async: asyncFn,
    };
  }

  private parsePrimaryExpr(): Expression {
    if (this.lexer.match(';')) {
      return EMPTY_EXPR;
    }

    if (this.lexer.matchTokenType(TokenType.LAMBDA_ARG)) {
      return {
        type: SyntaxType.LAMBDA_ARG,
        index: this.lexer.value(),
      };
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
      return this.parseFunctionExpr();
    }

    if (this.lexer.matchAsync()) {
      return this.parseAsyncFunctionExpr();
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

  private static pathContainsVariables(expr: PathExpression): boolean {
    return (
      !!expr.parts &&
      expr.parts
        .filter((part) => part.type === SyntaxType.SELECTOR)
        .map((part) => part as SelectorExpression)
        .some((part) => part.context?.index || part.context?.item)
    );
  }

  private static convertToBlockExpr(expr: Expression): FunctionExpression {
    return {
      type: SyntaxType.FUNCTION_EXPR,
      block: true,
      body: CommonUtils.convertToStatementsExpr(expr),
    };
  }
}
