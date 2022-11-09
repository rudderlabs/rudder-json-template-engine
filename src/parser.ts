import {
  Dictionary,
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
  PosFilterExpression,
} from './types';
import { JsosTemplateParserError } from './errors';
import { BINDINGS_PARAM_KEY, DATA_PARAM_KEY } from './contants';
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

  private parseStatementsExpr(): StatementsExpression {
    let statements: Expression[] = [];
    while (!this.lexer.match('}')) {
      let expr: Expression = this.parseStatementExpr();
      if (expr.type !== SyntaxType.EMPTY) {
        statements.push(expr);
      }
      if (this.lexer.matchTokenType(TokenType.EOT)) {
        break;
      }
      if (!this.lexer.match('}')) {
        this.lexer.expect(';');
      }
    }
    return {
      type: SyntaxType.STATEMENTS_EXPR,
      statements,
    };
  }

  private parseStatementExpr(): Expression {
    return this.parseAssignmentExpr();
  }

  private static getIDPath(expr: PathExpression): string {
    if (!expr.root || expr.root.startsWith(DATA_PARAM_KEY) || expr.parts.length) {
      throw new JsosTemplateParserError('Invalid ID path');
    }
    return expr.root;
  }

  private parseAssignmentExpr(): AssignmentExpression | Expression {
    const expr = this.parseLogicalORExpr();
    if (expr.type === SyntaxType.PATH && this.lexer.match('=')) {
      this.lexer.lex();
      return {
        type: SyntaxType.ASSIGNMENT_EXPR,
        value: this.parseLogicalORExpr(),
        id: JsonTemplateParser.getIDPath(expr as PathExpression),
      };
    }
    return expr;
  }

  private parsePathConcatExpr(): ConcatExpression | Expression {
    const expr = this.parsePathConcatPartExpr();
    let operands;

    while (this.lexer.match('|')) {
      this.lexer.lex();
      (operands || (operands = [expr])).push(this.parsePathConcatPartExpr());
    }

    return operands
      ? {
          type: SyntaxType.CONCAT_EXPR,
          args: operands,
        }
      : expr;
  }

  private parsePathConcatPartExpr(): Expression {
    return this.lexer.match('(') ? this.parsePathGroupExpr() : this.parsePath();
  }

  private parsePathGroupExpr(): Expression {
    this.lexer.expect('(');
    let expr = this.parseLogicalORExpr();
    this.lexer.expect(')');

    let parts: Expression[] = [];
    let part: Expression | undefined;
    while ((part = this.parsePathPart())) {
      parts.push(part);
    }

    if (!parts.length) {
      return expr;
    } else if (expr.type === SyntaxType.PATH) {
      expr.parts = (expr.parts || []).concat(parts);
      return expr;
    }

    parts.unshift(expr);

    return {
      type: SyntaxType.PATH,
      parts: parts,
    };
  }

  private parsePath(): PathExpression | FunctionCallExpression {
    if (!this.lexer.matchPath()) {
      JsonTemplateLexer.throwUnexpected(this.lexer.lex());
    }

    let root: string | undefined;

    if (this.lexer.match('^')) {
      this.lexer.lex();
      root = DATA_PARAM_KEY;
    } else if (this.lexer.matchID()) {
      const idPath = this.parsePathVariable();
      root = idPath.replace(/^\$/, `${BINDINGS_PARAM_KEY}.`);
    }

    let parts: Expression[] = [];
    let part: Expression | undefined;
    while ((part = this.parsePathPart())) {
      parts.push(part);
    }

    return {
      type: SyntaxType.PATH,
      root,
      parts,
    };
  }

  private parsePathPart(): Expression | undefined {
    if (this.lexer.matchSelector()) {
      return this.parseSelector();
    } else if (this.lexer.match('[')) {
      return this.parseFilterExpr();
    } else if (this.lexer.match('(')) {
      return this.parseFunctionCallExpr();
    }
  }

  private parseSelector(): SelectorExpression | Expression {
    let selector = this.lexer.lex().value;
    const token = this.lexer.lookahead();
    let prop: string | undefined;

    if (this.lexer.match('*') || token.type === TokenType.ID || token.type === TokenType.STR) {
      prop = this.lexer.lex().value;
    }

    return {
      type: SyntaxType.SELECTOR,
      selector: selector,
      prop,
    };
  }

  private parsePosFilterExpr(): PosFilterExpression {
    if (this.lexer.match(']')) {
      return {
        type: SyntaxType.POS_FILTER_EXPR,
        empty: true,
      };
    }
    if (this.lexer.match(':')) {
      this.lexer.lex();
      return {
        type: SyntaxType.POS_FILTER_EXPR,
        toIdx: this.parseLogicalORExpr(),
      };
    }

    let fromExpr = this.parseLogicalORExpr();
    if (this.lexer.match(':')) {
      this.lexer.lex();
      if (this.lexer.match(']')) {
        return {
          type: SyntaxType.POS_FILTER_EXPR,
          fromIdx: fromExpr,
        };
      }

      return {
        type: SyntaxType.POS_FILTER_EXPR,
        fromIdx: fromExpr,
        toIdx: this.parseLogicalORExpr(),
      };
    }

    return {
      type: SyntaxType.POS_FILTER_EXPR,
      idx: fromExpr,
    };
  }

  private parseObjectFilterExpression(): ObjectFilterExpression {
    const filters: Expression[] = [];
    while (this.lexer.match('{')) {
      this.lexer.expect('{');
      filters.push(this.parseLogicalORExpr());
      this.lexer.expect('}');
    }

    return {
      type: SyntaxType.OBJECT_FILTER_EXPR,
      filters,
    };
  }

  private parseFilterExpr(): Expression {
    this.lexer.expect('[');
    let expr = this.lexer.match('{')
      ? this.parseObjectFilterExpression()
      : this.parsePosFilterExpr();

    this.lexer.expect(']');

    return expr;
  }

  private parseLogicalORExpr(): BinaryExpression | Expression {
    let expr = this.parseLogicalANDExpr();

    while (this.lexer.match('||')) {
      expr = {
        type: SyntaxType.LOGICAL_EXPR,
        op: this.lexer.lex().value,
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
        op: this.lexer.lex().value,
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
        op: this.lexer.lex().value,
        args: [expr, this.parseEqualityExpr()],
      };
    }

    return expr;
  }

  private parseRelationalExpr(): BinaryExpression | Expression {
    let expr = this.parseAdditiveExpr();

    while (
      this.lexer.match('<') ||
      this.lexer.match('>') ||
      this.lexer.match('<=') ||
      this.lexer.match('>=')
    ) {
      expr = {
        type: SyntaxType.COMPARISON_EXPR,
        op: this.lexer.lex().value,
        args: [expr, this.parseRelationalExpr()],
      };
    }

    return expr;
  }

  private parseAdditiveExpr(): BinaryExpression | Expression {
    let expr = this.parseMultiplicativeExpr();

    while (this.lexer.match('+') || this.lexer.match('-')) {
      expr = {
        type: SyntaxType.MATH_EXPR,
        op: this.lexer.lex().value,
        args: [expr, this.parseMultiplicativeExpr()],
      };
    }

    return expr;
  }

  private parseMultiplicativeExpr(): BinaryExpression | Expression {
    let expr: Expression = this.parseUnaryExpr();

    while (this.lexer.match('*') || this.lexer.match('/') || this.lexer.match('%')) {
      expr = {
        type: SyntaxType.MATH_EXPR,
        op: this.lexer.lex().value as string,
        args: [expr, this.parseMultiplicativeExpr()],
      };
    }

    return expr;
  }

  private parseUnaryExpr(): UnaryExpression | Expression {
    if (this.lexer.match('!') || this.lexer.match('-') || this.lexer.match('...')) {
      return {
        type: SyntaxType.UNARY_EXPR,
        op: this.lexer.lex().value as string,
        arg: this.parseUnaryExpr(),
      };
    }

    return this.parsePrimaryExpr();
  }

  private parseLiteralExpr(): LiteralExpression {
    const token = this.lexer.lex();
    return {
      type: SyntaxType.LITERAL,
      value: token.value,
      tokenType: token.type,
    };
  }

  private parsePathVariable(): string {
    const idParts: string[] = [];
    while (this.lexer.matchID()) {
      idParts.push(this.lexer.lex().value);
      if (this.lexer.match('.') && this.lexer.matchID(1)) {
        this.lexer.lex();
      }
    }
    if (!idParts.length) {
      JsonTemplateLexer.throwUnexpected(this.lexer.lex());
    }
    return idParts.join('.');
  }

  private parseDefinitionExpr(): AssignmentExpression {
    this.lexer.expectTokenType(TokenType.DEFINITION);
    if (!this.lexer.matchID()) {
      JsonTemplateLexer.throwUnexpected(this.lexer.lex());
    }
    const id = this.lexer.lex().value;
    this.lexer.expect('=');

    return {
      type: SyntaxType.ASSIGNMENT_EXPR,
      id,
      value: this.parseLogicalORExpr(),
      isDefinition: true,
    };
  }

  private parseFunctionCallExpr(): FunctionCallExpression {
    const args: Expression[] = [];
    this.lexer.expect('(');
    while (!this.lexer.match(')')) {
      args.push(this.parseLogicalORExpr());
      if (!this.lexer.match(')')) {
        this.lexer.expect(',');
      }
    }
    this.lexer.expect(')');
    return {
      type: SyntaxType.FUNCTION_CALL_EXPR,
      args,
    };
  }

  private parsePrimaryExpr(): Expression {
    if (this.lexer.matchEOT() || this.lexer.match(';')) {
      return EMPTY_EXPR;
    }

    let token = this.lexer.lookahead();

    if (token.type === TokenType.DEFINITION) {
      return this.parseDefinitionExpr();
    }

    if (token.type === TokenType.FUNCTIION) {
      return this.parseFunctionExpr();
    }

    if (JsonTemplateLexer.isLiteralToken(token)) {
      return this.parseLiteralExpr();
    }

    if (this.lexer.matchSelector()) {
      return this.parsePathConcatExpr();
    }

    if (this.lexer.matchPath()) {
      return this.parsePath();
    }

    if (this.lexer.match('(')) {
      return this.parseGroupExpr();
    }

    if (this.lexer.match('{')) {
      return this.parseObjectExpr();
    }

    if (this.lexer.match('[')) {
      return this.parseArrayExpr();
    }

    return JsonTemplateLexer.throwUnexpected(this.lexer.lex());
  }

  private parseFunctionExpr(): FunctionExpression {
    this.lexer.expectTokenType(TokenType.FUNCTIION);
    this.lexer.expect('(');
    const params: string[] = [];
    while (!this.lexer.match(')')) {
      const token = this.lexer.lookahead();
      if (token.type !== TokenType.ID) {
        JsonTemplateLexer.throwUnexpected(token);
      }
      params.push(this.lexer.lex().value);
      if (!this.lexer.match(')')) {
        this.lexer.expect(',');
      }
    }
    this.lexer.expect(')');
    this.lexer.expect('{');
    const body = this.parseStatementsExpr();
    this.lexer.expect('}');
    return {
      type: SyntaxType.FUNCTION_EXPR,
      params,
      body,
    };
  }

  private parseObjectKeyExpr(): Expression | string {
    let key: Expression | string;
    if (this.lexer.match('[')) {
      this.lexer.lex();
      key = this.parseLogicalORExpr();
      this.lexer.expect(']');
    } else {
      key = `${this.lexer.lex().value}`;
    }
    return key;
  }

  private parseObjectExpr(): ObjectExpression {
    this.lexer.expect('{');
    const expr: ObjectExpression = {
      type: SyntaxType.OBJECT_EXPR,
      props: [],
    };
    while (!this.lexer.match('}')) {
      const key = this.parseObjectKeyExpr();
      this.lexer.expect(':');
      const value = this.parseLogicalORExpr();
      expr.props.push({ key, value });
      if (!this.lexer.match('}')) {
        this.lexer.expect(',');
      }
    }
    this.lexer.expect('}');
    return expr;
  }

  private parseArrayExpr(): ArrayExpression {
    this.lexer.expect('[');
    const elements: Expression[] = [];
    while (!this.lexer.match(']')) {
      const expr = this.parseLogicalANDExpr();
      elements.push(expr);
      if (!this.lexer.match(']')) {
        this.lexer.expect(',');
      }
    }
    this.lexer.expect(']');
    return { type: SyntaxType.ARRAY_EXPR, elements };
  }

  private parseGroupExpr(): Expression {
    this.lexer.expect('(');
    let expr = this.parseLogicalORExpr();
    this.lexer.expect(')');

    return expr;
  }
}
