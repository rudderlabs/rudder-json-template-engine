/* eslint-disable import/no-cycle */
import { BINDINGS_PARAM_KEY, DATA_PARAM_KEY, EMPTY_EXPR } from './constants';
import { JsonTemplateEngine } from './engine';
import { JsonTemplateLexerError, JsonTemplateParserError } from './errors';
import { JsonTemplateLexer } from './lexer';
import {
  ArrayExpression,
  ArrayFilterExpression,
  AssignmentExpression,
  BinaryExpression,
  BlockExpression,
  BlockExpressionOptions,
  ConditionalExpression,
  DefinitionExpression,
  EngineOptions,
  Expression,
  FunctionCallExpression,
  FunctionExpression,
  IncrementExpression,
  IndexFilterExpression,
  Keyword,
  LiteralExpression,
  LoopControlExpression,
  LoopExpression,
  ObjectExpression,
  ObjectFilterExpression,
  ObjectPropExpression,
  OperatorType,
  PathExpression,
  PathOptions,
  PathType,
  RangeFilterExpression,
  ReturnExpression,
  SelectorExpression,
  SpreadExpression,
  StatementsExpression,
  SyntaxType,
  ThrowExpression,
  Token,
  TokenType,
  UnaryExpression,
} from './types';
import {
  convertToStatementsExpr,
  createBlockExpression,
  getLastElement,
  toArray,
} from './utils/common';

type PathTypeResult = {
  pathType: PathType;
  inferredPathType: PathType;
};

export class JsonTemplateParser {
  private lexer: JsonTemplateLexer;

  private options?: EngineOptions;

  private pathTypesStack: PathTypeResult[] = [];

  // indicates currently how many loops being parsed
  private loopCount = 0;

  constructor(lexer: JsonTemplateLexer, options?: EngineOptions) {
    this.lexer = lexer;
    this.options = options;
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
    const code = this.lexer.getCode(currIdx, nextTokenStart);
    if (!code.includes('\n')) {
      this.lexer.throwUnexpectedToken();
    }
  }

  private parseStatements(blockEnd?: string): Expression[] {
    const statements: Expression[] = [];
    while (!this.lexer.matchEOT() && !this.lexer.match(blockEnd)) {
      statements.push(this.parseStatementExpr());
      this.parseEndOfStatement(blockEnd);
    }
    return statements;
  }

  private static validateStatements(
    statements: Expression[],
    options?: BlockExpressionOptions,
  ): void {
    if (!statements.length) {
      if (
        options?.parentType === SyntaxType.CONDITIONAL_EXPR ||
        options?.parentType === SyntaxType.LOOP_EXPR
      ) {
        throw new JsonTemplateParserError(
          'Empty statements are not allowed in loop and condtional expressions',
        );
      }
      return;
    }
    for (let i = 0; i < statements.length; i += 1) {
      const currStatement = statements[i];
      if (
        (currStatement.type === SyntaxType.RETURN_EXPR ||
          currStatement.type === SyntaxType.THROW_EXPR ||
          currStatement.type === SyntaxType.LOOP_CONTROL_EXPR) &&
        (options?.parentType !== SyntaxType.CONDITIONAL_EXPR || i !== statements.length - 1)
      ) {
        throw new JsonTemplateParserError(
          'return, throw, continue and break statements are only allowed as last statements in conditional expressions',
        );
      }
    }
  }

  private parseStatementsExpr(options?: BlockExpressionOptions): StatementsExpression {
    const statements = this.parseStatements(options?.blockEnd);
    JsonTemplateParser.validateStatements(statements, options);
    return {
      type: SyntaxType.STATEMENTS_EXPR,
      statements,
    };
  }

  private parseStatementExpr(): Expression {
    return this.parseBaseExpr();
  }

  private parseAssignmentExpr(): AssignmentExpression | Expression {
    const expr = this.parseNextExpr(OperatorType.ASSIGNMENT);
    if (expr.type === SyntaxType.PATH && this.lexer.matchAssignment()) {
      const op = this.lexer.value();
      const path = expr as PathExpression;
      if (!path.root || typeof path.root === 'object' || path.root === DATA_PARAM_KEY) {
        throw new JsonTemplateParserError('Invalid assignment path');
      }
      if (!JsonTemplateParser.isSimplePath(expr as PathExpression)) {
        throw new JsonTemplateParserError('Invalid assignment path');
      }
      path.inferredPathType = PathType.SIMPLE;
      return {
        type: SyntaxType.ASSIGNMENT_EXPR,
        value: this.parseBaseExpr(),
        op,
        path,
      } as AssignmentExpression;
    }
    return expr;
  }

  private parseBaseExpr(): Expression {
    const startIdx = this.lexer.currentIndex();
    try {
      return this.parseNextExpr(OperatorType.BASE);
    } catch (error: any) {
      const code = this.lexer.getCode(startIdx, this.lexer.currentIndex());
      if (error.message.includes('at')) {
        throw error;
      }
      throw new JsonTemplateParserError(`${error.message} at ${code}`);
    }
  }

  private parseNextExpr(currentOperation: OperatorType): Expression {
    switch (currentOperation) {
      case OperatorType.CONDITIONAL:
        return this.parseAssignmentExpr();
      case OperatorType.ASSIGNMENT:
        return this.parseCoalesceExpr();
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
        return this.parsePrefixIncreamentExpr();
      case OperatorType.PREFIX_INCREMENT:
        return this.parsePostfixIncreamentExpr();
      case OperatorType.POSTFIX_INCREMENT:
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
    } else if (this.lexer.match('{')) {
      return this.parseObjectFiltersExpr();
    } else if (this.lexer.match('[')) {
      return this.parseArrayFilterExpr();
    } else if (this.lexer.match('@') || this.lexer.match('#')) {
      return this.parsePathOptions();
    }
  }

  private parsePathParts(): Expression[] {
    let parts: Expression[] = [];
    let newParts: Expression[] | undefined = toArray(this.parsePathPart());
    while (newParts) {
      parts = parts.concat(newParts);
      if (newParts[0].type === SyntaxType.FUNCTION_CALL_EXPR) {
        break;
      }
      newParts = toArray(this.parsePathPart());
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
        // eslint-disable-next-line no-continue
        continue;
      }
      if (this.lexer.match('#')) {
        context.index = this.parseContextVariable();
        // eslint-disable-next-line no-continue
        continue;
      }
      if (this.lexer.matchToArray()) {
        this.lexer.ignoreTokens(2);
        context.toArray = true;
      }
    }
    return {
      type: SyntaxType.PATH_OPTIONS,
      options: context,
    };
  }

  private parsePathRoot(
    pathType: PathTypeResult,
    root?: Expression,
  ): Expression | string | undefined {
    if (root) {
      return root;
    }
    const nextToken = this.lexer.lookahead();
    if (nextToken.type === TokenType.ID && nextToken.value !== '$') {
      return this.lexer.value();
    }
    const tokenReturnValues = {
      '^': DATA_PARAM_KEY,
      $: pathType.inferredPathType === PathType.JSON ? DATA_PARAM_KEY : BINDINGS_PARAM_KEY,
      '@': undefined,
    };
    if (Object.prototype.hasOwnProperty.call(tokenReturnValues, nextToken.value)) {
      this.lexer.ignoreTokens(1);
      return tokenReturnValues[nextToken.value];
    }
  }

  private getInferredPathType(): PathTypeResult {
    if (this.pathTypesStack.length > 0) {
      return this.pathTypesStack[this.pathTypesStack.length - 1];
    }
    return {
      pathType: PathType.UNKNOWN,
      inferredPathType: this.options?.defaultPathType ?? PathType.RICH,
    };
  }

  private createPathResult(pathType: PathType) {
    return {
      pathType,
      inferredPathType: pathType,
    };
  }

  private parsePathType(): PathTypeResult {
    if (this.lexer.matchSimplePath()) {
      this.lexer.ignoreTokens(1);
      return this.createPathResult(PathType.SIMPLE);
    }
    if (this.lexer.matchRichPath()) {
      this.lexer.ignoreTokens(1);
      return this.createPathResult(PathType.RICH);
    }
    if (this.lexer.matchJsonPath()) {
      this.lexer.ignoreTokens(1);
      return this.createPathResult(PathType.JSON);
    }

    return this.getInferredPathType();
  }

  private parsePathTypeExpr(): Expression {
    const pathTypeResult = this.parsePathType();
    this.pathTypesStack.push(pathTypeResult);
    const expr = this.parseBaseExpr();
    this.pathTypesStack.pop();
    return expr;
  }

  private parsePath(options?: { root?: Expression }): PathExpression | Expression {
    const pathTypeResult = this.parsePathType();
    const expr: PathExpression = {
      type: SyntaxType.PATH,
      root: this.parsePathRoot(pathTypeResult, options?.root),
      parts: this.parsePathParts(),
      ...pathTypeResult,
    };
    if (!expr.parts.length) {
      expr.inferredPathType = PathType.SIMPLE;
      return expr;
    }
    return JsonTemplateParser.updatePathExpr(expr);
  }

  private static createArrayIndexFilterExpr(expr: Expression): IndexFilterExpression {
    return {
      type: SyntaxType.ARRAY_INDEX_FILTER_EXPR,
      indexes: {
        type: SyntaxType.ARRAY_EXPR,
        elements: [expr],
      },
    };
  }

  private static createArrayFilterExpr(
    expr: RangeFilterExpression | IndexFilterExpression,
  ): ArrayFilterExpression {
    return {
      type: SyntaxType.ARRAY_FILTER_EXPR,
      filter: expr,
    };
  }

  private parseSelector(): SelectorExpression | IndexFilterExpression | Expression {
    const selector = this.lexer.value();
    if (this.lexer.matchINT()) {
      return JsonTemplateParser.createArrayFilterExpr(
        JsonTemplateParser.createArrayIndexFilterExpr(this.parseLiteralExpr()),
      );
    }

    let prop: Token | undefined;
    if (
      this.lexer.match('*') ||
      this.lexer.matchID() ||
      this.lexer.matchKeyword() ||
      this.lexer.matchTokenType(TokenType.STR)
    ) {
      prop = this.lexer.lex();
      if (prop.type === TokenType.KEYWORD) {
        prop.type = TokenType.ID;
      }
    }
    return {
      type: SyntaxType.SELECTOR,
      selector,
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

    const fromExpr = this.parseBaseExpr();
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

  private parseArrayFilter(): Expression {
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
    if ((this.lexer.match('~') || this.lexer.match('!')) && this.lexer.match('[', 1)) {
      this.lexer.ignoreTokens(1);
      exclude = true;
    }
    if (this.lexer.match('[')) {
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

  private parseObjectFiltersExpr(): (ObjectFilterExpression | IndexFilterExpression)[] {
    const objectFilters: Expression[] = [];
    const indexFilters: IndexFilterExpression[] = [];

    while (this.lexer.match('{')) {
      this.lexer.expect('{');
      const expr = this.parseObjectFilter();
      if (expr.type === SyntaxType.OBJECT_INDEX_FILTER_EXPR) {
        indexFilters.push(expr as IndexFilterExpression);
      } else {
        objectFilters.push(expr.filter);
      }
      this.lexer.expect('}');
      if (this.lexer.match('.') && this.lexer.match('{', 1)) {
        this.lexer.ignoreTokens(1);
      }
    }

    if (!objectFilters.length) {
      return indexFilters;
    }

    const objectFilter: ObjectFilterExpression = {
      type: SyntaxType.OBJECT_FILTER_EXPR,
      filter: this.combineExpressionsAsBinaryExpr(objectFilters, SyntaxType.LOGICAL_AND_EXPR, '&&'),
    };

    return [objectFilter, ...indexFilters];
  }

  private parseLoopControlExpr(): LoopControlExpression {
    const control = this.lexer.value();
    if (!this.loopCount) {
      throw new JsonTemplateParserError(`encounted loop control outside loop: ${control}`);
    }
    return {
      type: SyntaxType.LOOP_CONTROL_EXPR,
      control,
    };
  }

  private parseCurlyBlockExpr(options?: BlockExpressionOptions): StatementsExpression {
    this.lexer.expect('{');
    const expr = this.parseStatementsExpr(options);
    this.lexer.expect('}');
    return expr;
  }

  private parseConditionalBodyExpr(): Expression {
    const currentIndex = this.lexer.currentIndex();
    if (this.lexer.match('{')) {
      try {
        return this.parseObjectExpr();
      } catch (error: any) {
        if (error instanceof JsonTemplateLexerError) {
          this.lexer.reset(currentIndex);
        }
        return this.parseCurlyBlockExpr({ blockEnd: '}', parentType: SyntaxType.CONDITIONAL_EXPR });
      }
    }
    return this.parseBaseExpr();
  }

  private parseConditionalExpr(): ConditionalExpression | Expression {
    const ifExpr = this.parseNextExpr(OperatorType.CONDITIONAL);

    if (this.lexer.match('?')) {
      this.lexer.ignoreTokens(1);
      const thenExpr = this.parseConditionalBodyExpr();
      let elseExpr: Expression | undefined;
      if (this.lexer.match(':')) {
        this.lexer.ignoreTokens(1);
        elseExpr = this.parseConditionalBodyExpr();
      }
      return {
        type: SyntaxType.CONDITIONAL_EXPR,
        if: ifExpr,
        then: thenExpr,
        else: elseExpr,
      };
    }

    return ifExpr;
  }

  private parseLoopExpr(): LoopExpression {
    this.loopCount++;
    this.lexer.ignoreTokens(1);
    let init: Expression | undefined;
    let test: Expression | undefined;
    let update: Expression | undefined;
    if (!this.lexer.match('{')) {
      this.lexer.expect('(');
      if (!this.lexer.match(';')) {
        init = this.parseAssignmentExpr();
      }
      this.lexer.expect(';');
      if (!this.lexer.match(';')) {
        test = this.parseLogicalORExpr();
      }
      this.lexer.expect(';');
      if (!this.lexer.match(')')) {
        update = this.parseAssignmentExpr();
      }
      this.lexer.expect(')');
    }
    const body = this.parseCurlyBlockExpr({ blockEnd: '}', parentType: SyntaxType.LOOP_EXPR });
    this.loopCount--;
    return {
      type: SyntaxType.LOOP_EXPR,
      init,
      test,
      update,
      body,
    };
  }

  private parseJSONObjectFilter(): ObjectFilterExpression {
    this.lexer.expect('?');
    const filter = this.parseBaseExpr();
    return {
      type: SyntaxType.OBJECT_FILTER_EXPR,
      filter,
    };
  }

  private parseAllFilter(): ObjectFilterExpression {
    this.lexer.expect('*');
    return {
      type: SyntaxType.OBJECT_FILTER_EXPR,
      filter: {
        type: SyntaxType.ALL_FILTER_EXPR,
      },
    };
  }

  private parseArrayFilterExpr(): ArrayFilterExpression | ObjectFilterExpression {
    this.lexer.expect('[');
    let expr: ArrayFilterExpression | ObjectFilterExpression;
    if (this.lexer.match('?')) {
      expr = this.parseJSONObjectFilter();
    } else if (this.lexer.match('*')) {
      expr = this.parseAllFilter();
    } else {
      expr = {
        type: SyntaxType.ARRAY_FILTER_EXPR,
        filter: this.parseArrayFilter(),
      };
    }
    this.lexer.expect(']');
    return expr;
  }

  private combineExpressionsAsBinaryExpr(
    values: Expression[],
    type: SyntaxType,
    op: string,
  ): BinaryExpression | Expression {
    if (!values?.length) {
      throw new JsonTemplateParserError('expected at least 1 expression');
    }
    if (values.length === 1) {
      return values[0];
    }
    return {
      type,
      op,
      args: [values.shift(), this.combineExpressionsAsBinaryExpr(values, type, op)],
    };
  }

  private parseArrayCoalesceExpr(): BinaryExpression | Expression {
    this.lexer.ignoreTokens(1);
    const expr = this.parseArrayExpr();
    return this.combineExpressionsAsBinaryExpr(
      expr.elements,
      SyntaxType.LOGICAL_COALESCE_EXPR,
      '??',
    );
  }

  private parseCoalesceExpr(): BinaryExpression | Expression {
    const expr = this.parseNextExpr(OperatorType.COALESCING);

    if (this.lexer.match('??')) {
      return {
        type: SyntaxType.LOGICAL_COALESCE_EXPR,
        op: this.lexer.value(),
        args: [expr, this.parseCoalesceExpr()],
      };
    }

    return expr;
  }

  private parseLogicalORExpr(): BinaryExpression | Expression {
    const expr = this.parseNextExpr(OperatorType.OR);

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
    const expr = this.parseNextExpr(OperatorType.AND);

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
    const expr = this.parseNextExpr(OperatorType.EQUALITY);

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
      this.lexer.match('==*') ||
      this.lexer.match('=~') ||
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

  private parseInExpr(expr: Expression): BinaryExpression {
    this.lexer.ignoreTokens(1);
    return {
      type: SyntaxType.IN_EXPR,
      op: Keyword.IN,
      args: [expr, this.parseRelationalExpr()],
    };
  }

  private parseRelationalExpr(): BinaryExpression | Expression {
    const expr = this.parseNextExpr(OperatorType.RELATIONAL);

    if (
      this.lexer.match('<') ||
      this.lexer.match('>') ||
      this.lexer.match('<=') ||
      this.lexer.match('>=') ||
      this.lexer.matchContains() ||
      this.lexer.matchSize() ||
      this.lexer.matchEmpty() ||
      this.lexer.matchAnyOf() ||
      this.lexer.matchSubsetOf()
    ) {
      return {
        type: SyntaxType.COMPARISON_EXPR,
        op: this.lexer.value(),
        args: [expr, this.parseRelationalExpr()],
      };
    }

    if (this.lexer.matchIN()) {
      return this.parseInExpr(expr);
    }

    if (this.lexer.matchNotIN()) {
      return {
        type: SyntaxType.UNARY_EXPR,
        op: '!',
        arg: createBlockExpression(this.parseInExpr(expr)),
      };
    }

    if (this.lexer.matchNoneOf()) {
      this.lexer.ignoreTokens(1);
      return {
        type: SyntaxType.UNARY_EXPR,
        op: '!',
        arg: createBlockExpression({
          type: SyntaxType.COMPARISON_EXPR,
          op: Keyword.ANYOF,
          args: [expr, this.parseRelationalExpr()],
        }),
      };
    }

    return expr;
  }

  private parseShiftExpr(): BinaryExpression | Expression {
    const expr = this.parseNextExpr(OperatorType.SHIFT);

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
    const expr = this.parseNextExpr(OperatorType.ADDITION);

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
    const expr = this.parseNextExpr(OperatorType.MULTIPLICATION);

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
    const expr = this.parseNextExpr(OperatorType.POWER);

    if (this.lexer.match('**')) {
      return {
        type: SyntaxType.MATH_EXPR,
        op: this.lexer.value() as string,
        args: [expr, this.parsePowerExpr()],
      };
    }

    return expr;
  }

  private parsePrefixIncreamentExpr(): IncrementExpression | Expression {
    if (this.lexer.matchIncrement() || this.lexer.matchDecrement()) {
      const op = this.lexer.value() as string;
      if (!this.lexer.matchID()) {
        throw new JsonTemplateParserError('Invalid prefix increment expression');
      }
      const id = this.lexer.value();
      return {
        type: SyntaxType.INCREMENT,
        op,
        id,
      };
    }

    return this.parseNextExpr(OperatorType.PREFIX_INCREMENT);
  }

  private static convertToID(expr: Expression): string {
    if (expr.type === SyntaxType.PATH) {
      const path = expr as PathExpression;
      if (
        !path.root ||
        typeof path.root !== 'string' ||
        path.parts.length !== 0 ||
        path.root === DATA_PARAM_KEY ||
        path.root === BINDINGS_PARAM_KEY
      ) {
        throw new JsonTemplateParserError('Invalid postfix increment expression');
      }
      return path.root;
    }
    throw new JsonTemplateParserError('Invalid postfix increment expression');
  }

  private parsePostfixIncreamentExpr(): IncrementExpression | Expression {
    const expr = this.parseNextExpr(OperatorType.POSTFIX_INCREMENT);

    if (this.lexer.matchIncrement() || this.lexer.matchDecrement()) {
      return {
        type: SyntaxType.INCREMENT,
        op: this.lexer.value() as string,
        id: JsonTemplateParser.convertToID(expr),
        postfix: true,
      };
    }

    return expr;
  }

  private parseUnaryExpr(): UnaryExpression | Expression {
    if (
      this.lexer.match('!') ||
      this.lexer.match('+') ||
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
      case SyntaxType.EMPTY:
      case SyntaxType.DEFINITION_EXPR:
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
      default: // Expected a default case
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
      this.lexer.matchPathType() ||
      this.lexer.matchPathPartSelector() ||
      this.lexer.match('{') ||
      this.lexer.match('[') ||
      this.lexer.match('(')
    ) {
      expr = this.parsePath({ root: expr });
    }
    return expr;
  }

  private static createLiteralExpr(token: Token): LiteralExpression {
    return {
      type: SyntaxType.LITERAL,
      value: token.value,
      tokenType: token.type,
    };
  }

  private parseLiteralExpr(): LiteralExpression {
    return JsonTemplateParser.createLiteralExpr(this.lexer.lex());
  }

  private parseIDPath(): string {
    const idParts: string[] = [];
    while (this.lexer.matchID()) {
      let idValue = this.lexer.value();
      if (idValue === '$') {
        idValue = BINDINGS_PARAM_KEY;
      }
      idParts.push(idValue);
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
        throw new JsonTemplateParserError('Invalid object vars');
      }
      vars.push(this.lexer.value());
      if (!this.lexer.match('}')) {
        this.lexer.expect(',');
      }
    }
    this.lexer.expect('}');
    if (vars.length === 0) {
      throw new JsonTemplateParserError('Empty object vars');
    }
    return vars;
  }

  private parseNormalDefVars(): string[] {
    const vars: string[] = [];
    if (!this.lexer.matchID()) {
      throw new JsonTemplateParserError('Invalid normal vars');
    }
    vars.push(this.lexer.value());
    return vars;
  }

  private parseDefinitionExpr(): DefinitionExpression {
    const definition = this.lexer.value();
    const fromObject = this.lexer.match('{');
    const vars: string[] = fromObject ? this.parseObjectDefVars() : this.parseNormalDefVars();
    this.lexer.expect('=');

    return {
      type: SyntaxType.DEFINITION_EXPR,
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
      id = `new ${this.parseIDPath()}`;
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
    return {
      type: SyntaxType.FUNCTION_EXPR,
      params,
      body: this.parseCurlyBlockExpr({ blockEnd: '}' }),
      async: asyncFn,
    };
  }

  private parseObjectKeyExpr(): Expression | string {
    let key: Expression | string;
    if (this.lexer.match('[')) {
      this.lexer.ignoreTokens(1);
      key = this.parseBaseExpr();
      this.lexer.expect(']');
    } else if (this.lexer.matchID() || this.lexer.matchKeyword()) {
      key = this.lexer.value();
    } else if (this.lexer.matchLiteral() && !this.lexer.matchTokenType(TokenType.REGEXP)) {
      key = this.lexer.value().toString();
    } else {
      this.lexer.throwUnexpectedToken();
    }
    return key;
  }

  private parseShortKeyValueObjectPropExpr(): ObjectPropExpression | undefined {
    if (
      (this.lexer.matchID() || this.lexer.matchKeyword()) &&
      (this.lexer.match(',', 1) || this.lexer.match('}', 1))
    ) {
      const key = this.lexer.lookahead().value;
      const value = this.parseBaseExpr();
      return {
        type: SyntaxType.OBJECT_PROP_EXPR,
        key,
        value,
      };
    }
  }

  private parseSpreadObjectPropExpr(): ObjectPropExpression | undefined {
    if (this.lexer.matchSpread()) {
      return {
        type: SyntaxType.OBJECT_PROP_EXPR,
        value: this.parseSpreadExpr(),
      };
    }
  }

  private getObjectPropContextVar(): string | undefined {
    if (this.lexer.matchObjectContextProp()) {
      this.lexer.ignoreTokens(1);
      return this.lexer.value();
    }
  }

  private parseNormalObjectPropExpr(): ObjectPropExpression {
    const contextVar = this.getObjectPropContextVar();
    const key = this.parseObjectKeyExpr();
    if (contextVar && typeof key === 'string') {
      throw new JsonTemplateParserError('Context prop is should be used with key expression');
    }
    this.lexer.expect(':');
    const value = this.parseBaseExpr();
    return {
      type: SyntaxType.OBJECT_PROP_EXPR,
      key,
      value,
      contextVar,
    };
  }

  private parseObjectPropExpr(): ObjectPropExpression {
    return (
      this.parseSpreadObjectPropExpr() ??
      this.parseShortKeyValueObjectPropExpr() ??
      this.parseNormalObjectPropExpr()
    );
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
    const statements: Expression[] = this.parseStatements(')');
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
    }
    if (this.lexer.matchLambda()) {
      return this.parseLambdaExpr(true);
    }
    this.lexer.throwUnexpectedToken();
  }

  private parseLambdaExpr(asyncFn = false): FunctionExpression {
    this.lexer.ignoreTokens(1);
    const expr = this.parseBaseExpr();
    return {
      type: SyntaxType.FUNCTION_EXPR,
      body: convertToStatementsExpr(expr),
      params: ['...args'],
      async: asyncFn,
      lambda: true,
    };
  }

  private parseCompileTimeBaseExpr(): Expression {
    this.lexer.expect('{');
    this.lexer.expect('{');
    const expr = this.parseBaseExpr();
    this.lexer.expect('}');
    this.lexer.expect('}');
    return expr;
  }

  private parseCompileTimeExpr(): Expression {
    this.lexer.expect('{');
    this.lexer.expect('{');
    const skipJsonify = this.lexer.matchCompileTimeExpr();
    const expr = skipJsonify ? this.parseCompileTimeBaseExpr() : this.parseBaseExpr();
    this.lexer.expect('}');
    this.lexer.expect('}');
    const exprVal = JsonTemplateEngine.createAsSync(expr).evaluate(
      {},
      this.options?.compileTimeBindings,
    );
    const template = skipJsonify ? exprVal : JSON.stringify(exprVal);
    return JsonTemplateParser.parseBaseExprFromTemplate(template as string);
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

  private parseReturnExpr(): ReturnExpression {
    this.lexer.ignoreTokens(1);
    let value: Expression | undefined;
    if (!this.lexer.match(';')) {
      value = this.parseBaseExpr();
    }
    return {
      type: SyntaxType.RETURN_EXPR,
      value,
    };
  }

  private parseThrowExpr(): ThrowExpression {
    this.lexer.ignoreTokens(1);
    return {
      type: SyntaxType.THROW_EXPR,
      value: this.parseBaseExpr(),
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
      case Keyword.RETURN:
        return this.parseReturnExpr();
      case Keyword.THROW:
        return this.parseThrowExpr();
      case Keyword.FUNCTION:
        return this.parseFunctionExpr();
      case Keyword.FOR:
        return this.parseLoopExpr();
      case Keyword.CONTINUE:
      case Keyword.BREAK:
        return this.parseLoopControlExpr();
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

    if (this.lexer.match('???')) {
      return this.parseArrayCoalesceExpr();
    }

    if (this.lexer.match('.') && this.lexer.matchINT(1) && !this.lexer.match('.', 2)) {
      return this.parseFloatingNumber();
    }

    if (this.lexer.matchLiteral()) {
      return this.parseLiteralExpr();
    }

    if (this.lexer.matchCompileTimeExpr()) {
      return this.parseCompileTimeExpr();
    }

    if (this.lexer.match('{')) {
      return this.parseObjectExpr();
    }

    if (this.lexer.match('[')) {
      return this.parseArrayExpr();
    }

    if (this.lexer.matchPathType()) {
      return this.parsePathTypeExpr();
    }

    if (this.lexer.matchPath()) {
      return this.parsePath();
    }

    if (this.lexer.match('(')) {
      return this.parseBlockExpr();
    }

    return this.lexer.throwUnexpectedToken();
  }

  private static pathContainsVariables(parts: Expression[]): boolean {
    return parts
      .filter((part) => part.type === SyntaxType.PATH_OPTIONS)
      .some((part) => part.options?.index ?? part.options?.item);
  }

  private static convertToBlockExpr(expr: Expression): FunctionExpression {
    return {
      type: SyntaxType.FUNCTION_EXPR,
      block: true,
      body: convertToStatementsExpr(expr),
    };
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
    const newParts: Expression[] = [];
    for (let i = 0; i < parts.length; i += 1) {
      const currPart = parts[i];
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
    const lastPart = getLastElement(pathExpr.parts);
    // Updated
    const newFnExpr = fnExpr;
    if (lastPart?.type === SyntaxType.SELECTOR) {
      const selectorExpr = lastPart as SelectorExpression;
      if (selectorExpr.selector === '.' && selectorExpr.prop?.type === TokenType.ID) {
        pathExpr.parts.pop();
        newFnExpr.id = selectorExpr.prop.value;
      }
    }

    if (!pathExpr.parts.length && pathExpr.root && typeof pathExpr.root !== 'object') {
      newFnExpr.parent = pathExpr.root;
    } else {
      newFnExpr.object = pathExpr;
    }
    return newFnExpr;
  }

  private static isArrayFilterExpressionSimple(expr: ArrayFilterExpression): boolean {
    if (expr.filter.type !== SyntaxType.ARRAY_INDEX_FILTER_EXPR) {
      return false;
    }
    const filter = expr.filter as IndexFilterExpression;
    return filter.indexes.elements.length <= 1;
  }

  private static isSimplePathPart(part: Expression): boolean {
    if (part.type === SyntaxType.SELECTOR) {
      const expr = part as SelectorExpression;
      return expr.selector === '.' && !!expr.prop && expr.prop.type !== TokenType.PUNCT;
    }
    if (part.type === SyntaxType.ARRAY_FILTER_EXPR) {
      return this.isArrayFilterExpressionSimple(part as ArrayFilterExpression);
    }
    return false;
  }

  private static isSimplePath(pathExpr: PathExpression): boolean {
    return pathExpr.parts.every((part) => this.isSimplePathPart(part));
  }

  private static isRichPath(pathExpr: PathExpression): boolean {
    if (!pathExpr.parts.length) {
      return false;
    }
    return !this.isSimplePath(pathExpr);
  }

  private static updatePathExpr(pathExpr: PathExpression): Expression {
    const newPathExpr = pathExpr;
    if (newPathExpr.parts.length > 1 && newPathExpr.parts[0].type === SyntaxType.PATH_OPTIONS) {
      newPathExpr.options = newPathExpr.parts[0].options;
      newPathExpr.parts.shift();
    }

    const shouldConvertAsBlock = JsonTemplateParser.pathContainsVariables(newPathExpr.parts);
    let lastPart = getLastElement(newPathExpr.parts);
    let fnExpr: FunctionCallExpression | undefined;
    if (lastPart?.type === SyntaxType.FUNCTION_CALL_EXPR) {
      fnExpr = newPathExpr.parts.pop() as FunctionCallExpression;
    }

    lastPart = getLastElement(newPathExpr.parts);
    if (lastPart?.type === SyntaxType.PATH_OPTIONS) {
      newPathExpr.parts.pop();
      newPathExpr.returnAsArray = lastPart.options?.toArray;
    }
    newPathExpr.parts = JsonTemplateParser.combinePathOptionParts(newPathExpr.parts);

    let expr: Expression = newPathExpr;
    if (fnExpr) {
      expr = JsonTemplateParser.convertToFunctionCallExpr(fnExpr, newPathExpr);
    }
    if (shouldConvertAsBlock) {
      expr = JsonTemplateParser.convertToBlockExpr(expr);
      newPathExpr.inferredPathType = PathType.RICH;
    } else if (this.isRichPath(newPathExpr)) {
      newPathExpr.inferredPathType = PathType.RICH;
    }
    return expr;
  }

  private static parseBaseExprFromTemplate(template: string): Expression {
    const lexer = new JsonTemplateLexer(template);
    const parser = new JsonTemplateParser(lexer);
    return parser.parseBaseExpr();
  }
}
