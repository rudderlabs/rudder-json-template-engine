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
  Token,
  IndexFilterExpression,
  DefinitionExpression,
  SpreadExpression,
  ObjectPropExpression,
  ConditionalExpression,
  OperatorType,
  ArrayFilterExpression,
  BlockExpression,
  PathOptions,
  CompileTimeExpression,
  Keyword,
} from './types';
import { JsonTemplateParserError } from './errors';
import { DATA_PARAM_KEY } from './constants';
import { JsonTemplateLexer } from './lexer';
import { CommonUtils } from './utils';

const EMPTY_EXPR = { type: SyntaxType.EMPTY };
export class JsonTemplateParser {
  private lexer: JsonTemplateLexer;

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
      this.lexer.ignoreTokens(1);
      return;
    }

    const currIdx = this.lexer.currentIndex();
    const nextTokenStart = this.lexer.lookahead().range[0];
    const code = this.lexer.getCodeChars(currIdx, nextTokenStart);
    if (!code.includes('\n')) {
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
    return this.parseBaseExpr();
  }

  private parseAssignmentExpr(): AssignmentExpression | Expression {
    const expr = this.parseNextExpr(OperatorType.ASSIGNMENT);
    if (expr.type === SyntaxType.PATH && this.lexer.match('=')) {
      this.lexer.ignoreTokens(1);
      const path = expr as PathExpression;
      path.jspath = true;
      return {
        type: SyntaxType.ASSIGNMENT_EXPR,
        value: this.parseBaseExpr(),
        path,
      } as AssignmentExpression;
    }
    return expr;
  }

  private parseBaseExpr(): Expression {
    return this.parseNextExpr(OperatorType.BASE);
  }

  private parseNextExpr(currentOperation: OperatorType): Expression {
    switch (currentOperation) {
      case OperatorType.CONDITIONAL:
        return this.parseAssignmentExpr();
      case OperatorType.ASSIGNMENT:
        return this.parseCoalescingExpr();
      case OperatorType.COALESCING:
        return this.parseLogicalORExpr();
      case OperatorType.OR:
        return this.parseLogicalANDExpr();
      case OperatorType.AND:
        return this.parseEqualityExpr();
      case OperatorType.EQUALITY:
        return this.parseRelationalExpr();
      case OperatorType.RELATIONAL:
        return this.parseShiftExpr();
      case OperatorType.SHIFT:
        return this.parseAdditiveExpr();
      case OperatorType.ADDITION:
        return this.parseMultiplicativeExpr();
      case OperatorType.MULTIPLICATION:
        return this.parsePowerExpr();
      case OperatorType.POWER:
        return this.parseUnaryExpr();
      case OperatorType.UNARY:
        return this.parsePathAfterExpr();
      default:
        return this.parseConditionalExpr();
    }
  }

  private parsePathPart(): Expression | Expression[] | undefined {
    if (this.lexer.match('.()')) {
      this.lexer.ignoreTokens(1);
    } else if (this.lexer.match('.') && this.lexer.match('(', 1)) {
      this.lexer.ignoreTokens(1);
      return this.parseBlockExpr();
    } else if (this.lexer.match('(')) {
      return this.parseFunctionCallExpr();
    } else if (this.lexer.matchPathPartSelector()) {
      return this.parseSelector();
    } else if (this.lexer.matchToArray()) {
      return this.parsePathOptions();
    } else if (this.lexer.match('[')) {
      return this.parseArrayFiltersExpr();
    } else if (this.lexer.match('{')) {
      return this.parseObjectFiltersExpr();
    } else if (this.lexer.match('@') || this.lexer.match('#')) {
      return this.parsePathOptions();
    }
  }

  private parsePathParts(): Expression[] {
    let parts: Expression[] = [];
    let newParts: Expression[] | undefined;
    while ((newParts = CommonUtils.toArray(this.parsePathPart()))) {
      parts = parts.concat(newParts);
      if (newParts[0].type === SyntaxType.FUNCTION_CALL_EXPR) {
        break;
      }
    }
    return JsonTemplateParser.ignoreEmptySelectors(parts);
  }

  private parseContextVariable(): string | undefined {
    this.lexer.ignoreTokens(1);
    if (!this.lexer.matchID()) {
      this.lexer.throwUnexpectedToken();
    }
    return this.lexer.value();
  }

  private parsePathOptions(): Expression {
    const context: PathOptions = {};
    while (this.lexer.match('@') || this.lexer.match('#') || this.lexer.matchToArray()) {
      if (this.lexer.match('@')) {
        context.item = this.parseContextVariable();
        continue;
      }
      if (this.lexer.match('#')) {
        context.index = this.parseContextVariable();
        continue;
      }
      if (this.lexer.matchToArray()) {
        this.lexer.ignoreTokens(2);
        context.toArray = true;
        continue;
      }
    }
    return {
      type: SyntaxType.PATH_OPTIONS,
      options: context,
    };
  }

  private parsePathRoot(root?: Expression): Expression | string | undefined {
    if (root) {
      return root;
    }
    if (this.lexer.match('^')) {
      this.lexer.ignoreTokens(1);
      return DATA_PARAM_KEY;
    } else if (this.lexer.matchID()) {
      return this.lexer.value();
    }
  }

  private updatePathExpr(pathExpr: PathExpression): Expression {
    if (pathExpr.parts.length > 1 && pathExpr.parts[0].type === SyntaxType.PATH_OPTIONS) {
      pathExpr.options = pathExpr.parts[0].options;
      pathExpr.parts.shift();
    }

    JsonTemplateParser.setSubpath(pathExpr.parts);
    const shouldConvertAsBlock = JsonTemplateParser.pathContainsVariables(pathExpr.parts);
    let lastPart = CommonUtils.getLastElement(pathExpr.parts);
    let fnExpr: FunctionCallExpression | undefined;
    if (lastPart?.type === SyntaxType.FUNCTION_CALL_EXPR) {
      fnExpr = pathExpr.parts.pop() as FunctionCallExpression;
    }

    lastPart = CommonUtils.getLastElement(pathExpr.parts);
    if (lastPart?.type === SyntaxType.PATH_OPTIONS) {
      pathExpr.parts.pop();
      pathExpr.returnAsArray = lastPart.options?.toArray;
    }
    pathExpr.parts = JsonTemplateParser.combinePathOptionParts(pathExpr.parts);

    let expr: Expression = pathExpr;
    if (fnExpr) {
      expr = JsonTemplateParser.convertToFunctionCallExpr(fnExpr, pathExpr);
    }
    if (shouldConvertAsBlock) {
      expr = JsonTemplateParser.convertToBlockExpr(expr);
    }
    return expr;
  }

  private parseJSPath(): Expression {
    this.lexer.ignoreTokens(1);
    return this.parsePath({ jspath: true });
  }

  private parsePath(options?: {
    root?: Expression;
    jspath?: boolean;
  }): PathExpression | Expression {
    let expr: PathExpression = {
      type: SyntaxType.PATH,
      root: this.parsePathRoot(options?.root),
      parts: this.parsePathParts(),
      jspath: options?.jspath,
    };
    if (!expr.parts.length) {
      return expr;
    }
    return this.updatePathExpr(expr);
  }

  private createArrayIndexFilterExpr(expr: Expression): IndexFilterExpression {
    return {
      type: SyntaxType.ARRAY_INDEX_FILTER_EXPR,
      indexes: {
        type: SyntaxType.ARRAY_EXPR,
        elements: [expr],
      },
    };
  }

  private createArrayFilterExpr(
    expr: RangeFilterExpression | IndexFilterExpression,
  ): ArrayFilterExpression {
    return {
      type: SyntaxType.ARRAY_FILTER_EXPR,
      filters: [expr],
    };
  }

  private parseSelector(): SelectorExpression | IndexFilterExpression | Expression {
    let selector = this.lexer.value();
    if (this.lexer.matchINT()) {
      return this.createArrayFilterExpr(this.createArrayIndexFilterExpr(this.parseLiteralExpr()));
    }

    let prop: Token | undefined;
    if (this.lexer.match('*') || this.lexer.matchID() || this.lexer.matchTokenType(TokenType.STR)) {
      prop = this.lexer.lex();
    }
    return {
      type: SyntaxType.SELECTOR,
      selector: selector,
      prop,
    };
  }

  private parseRangeFilterExpr(): RangeFilterExpression | Expression {
    if (this.lexer.match(':')) {
      this.lexer.ignoreTokens(1);
      return {
        type: SyntaxType.RANGE_FILTER_EXPR,
        toIdx: this.parseBaseExpr(),
      };
    }

    let fromExpr = this.parseBaseExpr();
    if (this.lexer.match(':')) {
      this.lexer.ignoreTokens(1);
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
    return fromExpr;
  }

  private parseArrayIndexFilterExpr(expr?: Expression): IndexFilterExpression {
    const parts: Expression[] = [];
    if (expr) {
      parts.push(expr);
      if (!this.lexer.match(']')) {
        this.lexer.expect(',');
      }
    }
    return {
      type: SyntaxType.ARRAY_INDEX_FILTER_EXPR,
      indexes: {
        type: SyntaxType.ARRAY_EXPR,
        elements: [
          ...parts,
          ...this.parseCommaSeparatedElements(']', () => this.parseSpreadExpr()),
        ],
      },
    };
  }

  private parseArrayFilterExpr(): Expression {
    if (this.lexer.matchSpread()) {
      return this.parseArrayIndexFilterExpr();
    }
    const expr = this.parseRangeFilterExpr();
    if (expr.type === SyntaxType.RANGE_FILTER_EXPR) {
      return expr;
    }
    return this.parseArrayIndexFilterExpr(expr);
  }

  private parseObjectFilter(): IndexFilterExpression | ObjectFilterExpression {
    let exclude = false;
    if (this.lexer.match('~')) {
      this.lexer.ignoreTokens(1);
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

  private combineObjectFilters(objectFilters: ObjectFilterExpression[]): ObjectFilterExpression[] {
    if (objectFilters.length <= 1) {
      return objectFilters;
    }
    const expr1 = objectFilters.shift() as ObjectFilterExpression;
    const expr2 = this.combineObjectFilters(objectFilters);
    return [
      {
        type: SyntaxType.OBJECT_FILTER_EXPR,
        filter: {
          type: SyntaxType.LOGICAL_AND_EXPR,
          op: '&&',
          args: [expr1.filter, expr2[0].filter],
        },
      },
    ];
  }

  private parseObjectFiltersExpr(): (ObjectFilterExpression | IndexFilterExpression)[] {
    const objectFilters: ObjectFilterExpression[] = [];
    const indexFilters: IndexFilterExpression[] = [];

    while (this.lexer.match('{')) {
      this.lexer.expect('{');
      const expr = this.parseObjectFilter();
      if (expr.type === SyntaxType.OBJECT_INDEX_FILTER_EXPR) {
        indexFilters.push(expr as IndexFilterExpression);
      } else {
        objectFilters.push(expr as ObjectFilterExpression);
      }
      this.lexer.expect('}');
      if (this.lexer.match('.') && this.lexer.match('{', 1)) {
        this.lexer.ignoreTokens(1);
      }
    }

    return [...this.combineObjectFilters(objectFilters), ...indexFilters];
  }

  private parseConditionalExpr(): ConditionalExpression | Expression {
    const ifExpr = this.parseNextExpr(OperatorType.CONDITIONAL);

    if (this.lexer.match('?')) {
      this.lexer.ignoreTokens(1);
      const thenExpr = this.parseConditionalExpr();
      if (this.lexer.match(':')) {
        this.lexer.ignoreTokens(1);
        const elseExpr = this.parseConditionalExpr();
        return {
          type: SyntaxType.CONDITIONAL_EXPR,
          if: ifExpr,
          then: thenExpr,
          else: elseExpr,
        };
      }
      return {
        type: SyntaxType.CONDITIONAL_EXPR,
        if: ifExpr,
        then: thenExpr,
        else: {
          type: SyntaxType.LITERAL,
          tokenType: TokenType.UNDEFINED,
        },
      };
    }

    return ifExpr;
  }

  private parseArrayFiltersExpr(): ArrayFilterExpression {
    const filters: Expression[] = [];
    while (this.lexer.match('[') && !this.lexer.match(']', 1)) {
      this.lexer.ignoreTokens(1);
      filters.push(this.parseArrayFilterExpr());
      this.lexer.expect(']');
      if (this.lexer.match('.') && this.lexer.match('[', 1)) {
        this.lexer.ignoreTokens(1);
      }
    }
    return {
      type: SyntaxType.ARRAY_FILTER_EXPR,
      filters,
    };
  }

  private parseCoalescingExpr(): BinaryExpression | Expression {
    let expr = this.parseNextExpr(OperatorType.COALESCING);

    if (this.lexer.match('??')) {
      return {
        type: SyntaxType.LOGICAL_COALESCE_EXPR,
        op: this.lexer.value(),
        args: [expr, this.parseCoalescingExpr()],
      };
    }

    return expr;
  }

  private parseLogicalORExpr(): BinaryExpression | Expression {
    let expr = this.parseNextExpr(OperatorType.OR);

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
    let expr = this.parseNextExpr(OperatorType.AND);

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
    let expr = this.parseNextExpr(OperatorType.EQUALITY);

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
    let expr = this.parseNextExpr(OperatorType.RELATIONAL);

    if (
      this.lexer.match('<') ||
      this.lexer.match('>') ||
      this.lexer.match('<=') ||
      this.lexer.match('>=') ||
      this.lexer.matchIN()
    ) {
      return {
        type: this.lexer.matchIN() ? SyntaxType.IN_EXPR : SyntaxType.COMPARISON_EXPR,
        op: this.lexer.value(),
        args: [expr, this.parseRelationalExpr()],
      };
    }

    return expr;
  }

  private parseShiftExpr(): BinaryExpression | Expression {
    let expr = this.parseNextExpr(OperatorType.SHIFT);

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
    let expr = this.parseNextExpr(OperatorType.ADDITION);

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
    let expr = this.parseNextExpr(OperatorType.MULTIPLICATION);

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
    let expr = this.parseNextExpr(OperatorType.POWER);

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

    return this.parseNextExpr(OperatorType.UNARY);
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
      case SyntaxType.ARRAY_EXPR:
      case SyntaxType.OBJECT_EXPR:
        if (this.lexer.match('(')) {
          return true;
        }
        break;
      case SyntaxType.FUNCTION_EXPR:
        if (!this.lexer.match('(')) {
          return true;
        }
        break;
    }
    return false;
  }

  private parsePathAfterExpr(): PathExpression | Expression {
    let expr = this.parsePrimaryExpr();
    if (this.shouldSkipPathParsing(expr)) {
      return expr;
    }
    while (
      this.lexer.matchPathPartSelector() ||
      this.lexer.match('{') ||
      this.lexer.match('[') ||
      this.lexer.match('(')
    ) {
      expr = this.parsePath({ root: expr });
    }
    return expr;
  }

  private createLiteralExpr(token: Token): LiteralExpression {
    return {
      type: SyntaxType.LITERAL,
      value: token.value,
      tokenType: token.type,
    };
  }

  private parseLiteralExpr(): LiteralExpression {
    return this.createLiteralExpr(this.lexer.lex());
  }

  private parseIDPath(): string {
    const idParts: string[] = [];
    while (this.lexer.matchID()) {
      idParts.push(this.lexer.value());
      if (this.lexer.match('.') && this.lexer.matchID(1)) {
        this.lexer.ignoreTokens(1);
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
        throw new JsonTemplateParserError('Invalid object vars at ' + this.lexer.getContext());
      }
      vars.push(this.lexer.value());
      if (!this.lexer.match('}')) {
        this.lexer.expect(',');
      }
    }
    this.lexer.expect('}');
    if (vars.length === 0) {
      throw new JsonTemplateParserError('Empty object vars at ' + this.lexer.getContext());
    }
    return vars;
  }

  private parseNormalDefVars(): string[] {
    const vars: string[] = [];
    if (!this.lexer.matchID()) {
      throw new JsonTemplateParserError('Invalid normal vars at ' + this.lexer.getContext());
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
      this.lexer.ignoreTokens(1);
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
      this.lexer.ignoreTokens(1);
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
    this.lexer.ignoreTokens(1);
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
      this.lexer.ignoreTokens(1);
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
      this.lexer.ignoreTokens(1);
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

  private parseBlockExpr(): BlockExpression | Expression {
    this.lexer.expect('(');
    let statements: Expression[] = this.parseStatements(')');
    this.lexer.expect(')');
    if (statements.length === 0) {
      throw new JsonTemplateParserError('empty block is not allowed');
    }
    return {
      type: SyntaxType.BLOCK_EXPR,
      statements,
    };
  }

  private parseAsyncFunctionExpr(): FunctionExpression {
    this.lexer.ignoreTokens(1);
    if (this.lexer.matchFunction()) {
      return this.parseFunctionExpr(true);
    } else if (this.lexer.matchLambda()) {
      return this.parseLambdaExpr(true);
    }
    this.lexer.throwUnexpectedToken();
  }

  private parseLambdaExpr(asyncFn = false): FunctionExpression {
    this.lexer.ignoreTokens(1);
    const expr = this.parseBaseExpr();
    return {
      type: SyntaxType.FUNCTION_EXPR,
      body: CommonUtils.convertToStatementsExpr(expr),
      params: ['...args'],
      async: asyncFn,
    };
  }

  private parseCompileTimeExpr(): CompileTimeExpression {
    this.lexer.expect('{');
    this.lexer.expect('{');
    const expr = this.parseBaseExpr();
    this.lexer.expect('}');
    this.lexer.expect('}');
    return {
      type: SyntaxType.COMPILE_TIME_EXPR,
      value: expr,
    };
  }

  private parseNumber(): LiteralExpression {
    let val = this.lexer.value();
    if (this.lexer.match('.')) {
      val += this.lexer.value();
      if (this.lexer.matchINT()) {
        val += this.lexer.value();
      }
      return {
        type: SyntaxType.LITERAL,
        value: parseFloat(val),
        tokenType: TokenType.FLOAT,
      };
    }
    return {
      type: SyntaxType.LITERAL,
      value: parseInt(val, 10),
      tokenType: TokenType.INT,
    };
  }

  private parseFloatingNumber(): LiteralExpression {
    const val = this.lexer.value() + this.lexer.value();
    return {
      type: SyntaxType.LITERAL,
      value: parseFloat(val),
      tokenType: TokenType.FLOAT,
    };
  }

  private parseKeywordBasedExpr(): Expression {
    const token = this.lexer.lookahead();
    switch (token.value) {
      case Keyword.NEW:
        return this.parseFunctionCallExpr();
      case Keyword.LAMBDA:
        return this.parseLambdaExpr();
      case Keyword.ASYNC:
        return this.parseAsyncFunctionExpr();
      case Keyword.FUNCTION:
        return this.parseFunctionExpr();
      case Keyword.JSPATH:
        return this.parseJSPath();
      default:
        return this.parseDefinitionExpr();
    }
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

    if (this.lexer.matchKeyword()) {
      return this.parseKeywordBasedExpr();
    }

    if (this.lexer.matchINT()) {
      return this.parseNumber();
    }

    if (this.lexer.match('.') && this.lexer.matchINT(1) && !this.lexer.match('.', 2)) {
      return this.parseFloatingNumber();
    }

    if (this.lexer.matchLiteral()) {
      return this.parseLiteralExpr();
    }

    if (this.lexer.match('{') && this.lexer.match('{', 1)) {
      return this.parseCompileTimeExpr();
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

  private static setSubpath(parts: any[]) {
    let remainingParts = parts.slice();
    while (remainingParts.length) {
      const part = remainingParts.shift();
      if (!part || typeof part !== 'object') {
        continue;
      }
      if (part.type === SyntaxType.PATH && Array.isArray(part.parts)) {
        part.subPath = !part.root;
      } else {
        for (let key in part) {
          remainingParts = remainingParts.concat(CommonUtils.toArray(part[key]));
        }
      }
    }
  }

  private static pathContainsVariables(parts: Expression[]): boolean {
    return parts
      .filter((part) => part.type === SyntaxType.PATH_OPTIONS)
      .some((part) => part.options?.index || part.options?.item);
  }

  private static convertToBlockExpr(expr: Expression): FunctionExpression {
    return {
      type: SyntaxType.FUNCTION_EXPR,
      block: true,
      body: CommonUtils.convertToStatementsExpr(expr),
    };
  }

  private static prependFunctionID(prefix: string, id?: string): string {
    return id ? prefix + '.' + id : prefix;
  }

  private static ignoreEmptySelectors(parts: Expression[]): Expression[] {
    return parts.filter(
      (part) => !(part.type === SyntaxType.SELECTOR && part.selector === '.' && !part.prop),
    );
  }

  private static combinePathOptionParts(parts: Expression[]): Expression[] {
    if (parts.length < 2) {
      return parts;
    }
    let newParts: Expression[] = [];
    for (let i = 0; i < parts.length; i++) {
      let currPart = parts[i];
      if (i < parts.length - 1 && parts[i + 1].type === SyntaxType.PATH_OPTIONS) {
        currPart.options = parts[i + 1].options;
        i++;
      }
      newParts.push(currPart);
    }
    return newParts;
  }

  private static convertToFunctionCallExpr(
    fnExpr: FunctionCallExpression,
    pathExpr: PathExpression,
  ): FunctionCallExpression | PathExpression {
    let lastPart = CommonUtils.getLastElement(pathExpr.parts);
    if (lastPart?.type === SyntaxType.SELECTOR) {
      const selectorExpr = lastPart as SelectorExpression;
      if (selectorExpr.selector === '.' && selectorExpr.prop?.type === TokenType.ID) {
        pathExpr.parts.pop();
        fnExpr.id = selectorExpr.prop.value;
        fnExpr.dot = true;
      }
    }

    if (!pathExpr.parts.length && pathExpr.root && typeof pathExpr.root !== 'object') {
      fnExpr.id = this.prependFunctionID(pathExpr.root, fnExpr.id);
      fnExpr.dot = false;
    } else {
      fnExpr.object = pathExpr;
    }
    return fnExpr;
  }
}
