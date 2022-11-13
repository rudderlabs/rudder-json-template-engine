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
} from './types';
import { JsosTemplateParserError } from './errors';
import { BINDINGS_PARAM_KEY, DATA_PARAM_KEY } from './constants';
import { JsonTemplateLexer } from './lexer';

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

  private parseStatements(blockEnd = ')'): Expression[] {
    let statements: Expression[] = [];
    while (!this.lexer.match(blockEnd)) {
      let expr: Expression = this.parseStatementExpr();
      if (expr.type !== SyntaxType.EMPTY) {
        statements.push(expr);
      }
      if (this.lexer.matchTokenType(TokenType.EOT)) {
        break;
      }
      if (!this.lexer.match(blockEnd)) {
        this.lexer.expect(';');
      }
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

  private parsePathConcatExpr(): ConcatExpression | Expression {
    const expr = this.parsePathConcatPartExpr();
    let operands: Expression[] = [];

    while (this.lexer.match('|')) {
      this.lexer.lex();
      operands.push(this.parsePathConcatPartExpr());
    }

    if (operands.length) {
      return {
        type: SyntaxType.CONCAT_EXPR,
        args: [expr, ...operands],
      };
    }

    return expr;
  }

  private parsePathConcatPartExpr(): Expression {
    return this.lexer.match('(') ? this.parsePathGroupExpr() : this.parsePath();
  }

  private parsePathGroupExpr(): Expression {
    this.lexer.expect('(');
    let expr = this.parseLogicalORExpr();
    this.lexer.expect(')');

    let parts: Expression[] = this.parsePathParts();

    if (!parts.length) {
      return expr;
    } else if (expr.type === SyntaxType.PATH) {
      expr.parts = expr.parts.concat(parts);
      return expr;
    }

    return {
      type: SyntaxType.PATH,
      parts: [expr, ...parts],
    };
  }

  private parsePathPart(): Expression | undefined {
    if (this.lexer.match('.') && this.lexer.match('{', 1)) {
      this.lexer.lex();
      return this.parseObjectExpr();
    } else if (this.lexer.match('.') && this.lexer.match('[', 1)) {
      this.lexer.lex();
      return this.parseArrayExpr();
    } else if (this.lexer.match('.') && this.lexer.match('(', 1)) {
      this.lexer.lex();
      return this.parseBlockExpr();
    } else if (this.lexer.match('(')) {
      return this.parseFunctionCallExpr();
    } else if (this.lexer.matchSelector()) {
      return this.parseSelector();
    } else if (this.lexer.match('[')) {
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
    }
    return parts;
  }

  private parsePath(): PathExpression {
    if (!this.lexer.matchPath()) {
      this.lexer.throwUnexpectedToken();
    }

    let root: string | undefined;

    if (this.lexer.match('^')) {
      this.lexer.lex();
      root = DATA_PARAM_KEY;
    } else if (this.lexer.matchID()) {
      root = this.lexer.value();
    }

    return {
      type: SyntaxType.PATH,
      root,
      parts: this.parsePathParts(),
    };
  }

  private parsePathVariable(expected: string): string | undefined {
    if (this.lexer.match(expected)) {
      this.lexer.expect(expected);
      if (this.lexer.matchID()) {
        return this.lexer.value();
      }
      this.lexer.throwUnexpectedToken();
    }
  }

  private parseSelector(): SelectorExpression | Expression {
    let selector = this.lexer.value();
    let prop: Token | undefined;
    let contextVar: string | undefined;
    if (this.lexer.match('*')) {
      prop = this.lexer.lex();
    }
    if (this.lexer.matchID() || this.lexer.matchTokenType(TokenType.STR)) {
      prop = this.lexer.lex();
      contextVar = this.parsePathVariable('@');
    }
    return {
      type: SyntaxType.SELECTOR,
      selector: selector,
      prop,
      contextVar,
    };
  }

  private parsePositionFilterExpr(): RangeFilterExpression | IndexFilterExpression {
    if (this.lexer.match(']')) {
      return {
        type: SyntaxType.RANGE_FILTER_EXPR,
      };
    }
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

  private parsePathAfterExpr(): PathExpression | Expression {
    const expr = this.parsePrimaryExpr();
    if (this.lexer.matchSelector() || this.lexer.match('[') || this.lexer.match('(')) {
      return {
        type: SyntaxType.PATH,
        parts: [expr, ...this.parsePathParts()],
      };
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
    return idParts.join('.').replace(/^\$/, `${BINDINGS_PARAM_KEY}.`);
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
    if (this.lexer.match('...')) {
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

  // private parseShortFunction(): FunctionExpression {
  //   this.lexer.expect('{');
  //   let body: Expression;
  //   if(this.lexer.match('{')) {
  //     body = this.parseObjectExpr();
  //   } else {
  //     body = 
  //   }
  // }

  private parseObjectPropExpr(): ObjectPropExpression {
    let key: Expression | string | undefined;
    if (!this.lexer.match('...')) {
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
      const expr = parseFn();
      elements.push(expr);
      if (!this.lexer.match(blockEnd)) {
        this.lexer.expect(',');
      }
    }
    return elements;
  }

  private parseSpreadExpr(): SpreadExpression | Expression {
    if (this.lexer.match('...')) {
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
    if(this.lexer.matchID() && (this.lexer.match(',') || this.lexer.match('=>'))) {

    }
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

    if(this.lexer.matchTokenType(TokenType.LAMBDA_ARG)) {
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

    if (this.lexer.matchSelector()) {
      return this.parsePathConcatExpr();
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
