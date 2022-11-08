import { Dictionary } from './types';
import { JsonTemplateParserError } from './error';
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
  Token,
  TokenType,
  UnaryExpression,
} from './types';

const MESSAGES = {
  INVALID_ID: 'Invalid variable name "%0"',
  RESERVED_ID: 'Reserved variable name "%0"',
  UNEXP_TOKEN: 'Unexpected token "%0"',
  UNEXP_EOT: 'Unexpected end of template',
};

const EMPTY_EXPR = { type: SyntaxType.EMPTY };
export class JsonTemplateParser {
  private readonly codeChars: string[];
  private buf?: Token;
  private idx = 0;
  private expr?: Expression;

  constructor(template: string) {
    this.codeChars = template.split('');
  }

  static throwUnexpected(token): never {
    if (token.type === TokenType.EOT) {
      this.throwError(token, MESSAGES.UNEXP_EOT);
    }

    this.throwError(token, MESSAGES.UNEXP_TOKEN, token.value);
  }

  static throwError(token: Token, messageFormat: string, ...args): never {
    const msg = messageFormat.replace(/%(\d)/g, (_, idx) => {
      return args[idx] || '';
    });
    throw new JsonTemplateParserError(msg, token.range[0]);
  }

  validateNoMoreTokensLeft() {
    const token = this.lex();

    if (token.type !== TokenType.EOT) {
      JsonTemplateParser.throwUnexpected(token);
    }
  }

  static isLiteralToken(token: Token) {
    return (
      token.type === TokenType.BOOL ||
      token.type === TokenType.NUM ||
      token.type === TokenType.STR ||
      token.type === TokenType.NULL
    );
  }

  parse(): Expression {
    if (!this.expr) {
      const expr = this.parseStatementsExpr();
      this.validateNoMoreTokensLeft();
      this.expr = expr;
    }
    return this.expr;
  }

  private parseStatementsExpr(): StatementsExpression {
    let statements: Expression[] = [];
    while (!this.match('}')) {
      let expr: Expression = this.parseStatementExpr();
      if (expr.type !== SyntaxType.EMPTY) {
        statements.push(expr);
      }
      if (this.matchTokenType(TokenType.EOT)) {
        break;
      }
      if (!this.match('}')) {
        this.expect(';');
      }
    }
    return {
      type: SyntaxType.STATEMENTS_EXPR,
      statements,
    };
  }

  private parseStatementExpr(): Expression {
    return this.parseLogicalANDExpr();
  }

  private parsePathConcatExpr(): ConcatExpression | Expression {
    const expr = this.parsePathConcatPartExpr();
    let operands;

    while (this.match('|')) {
      this.lex();
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
    return this.match('(') ? this.parsePathGroupExpr() : this.parsePath();
  }

  private parsePathGroupExpr(): Expression {
    this.expect('(');
    let expr = this.parseLogicalORExpr();
    this.expect(')');

    let parts: Expression[] = [];
    let part: Expression | undefined;
    while ((part = this.parsePredicate())) {
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

  private parsePredicate(): Expression | undefined {
    if (this.match('[')) {
      return this.parsePosPredicate();
    }

    if (this.match('{')) {
      return this.parseObjectPredicate();
    }

    if (this.match('(')) {
      return this.parsePathGroupExpr();
    }
  }

  private parsePath(): PathExpression {
    if (!this.matchPath()) {
      JsonTemplateParser.throwUnexpected(this.lex());
    }

    let root: string | undefined;

    if (this.match('^')) {
      this.lex();
      root = 'data';
    } else if (this.matchID()) {
      root = this.lex().value;
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
    return this.matchSelector() ? this.parseSelector() : this.parsePredicate();
  }

  private parseSelector(): SelectorExpression {
    let selector = this.lex().value;
    const token = this.lookahead();
    let prop: string | undefined;

    if (this.match('*') || token.type === TokenType.ID || token.type === TokenType.STR) {
      prop = this.lex().value;
    }

    return {
      type: SyntaxType.SELECTOR,
      selector: selector,
      prop,
    };
  }

  private parsePosPredicate(): PosExpression {
    this.expect('[');
    let expr = this.parsePosExpr();
    this.expect(']');

    return expr;
  }

  private parseObjectPredicate(): ObjectPredicateExpression {
    this.expect('{');
    let expr = this.parseLogicalORExpr();
    this.expect('}');

    return {
      type: SyntaxType.OBJ_PRED,
      arg: expr,
    };
  }

  private parseLogicalORExpr(): BinaryExpression | Expression {
    let expr = this.parseLogicalANDExpr();

    while (this.match('||')) {
      expr = {
        type: SyntaxType.LOGICAL_EXPR,
        op: this.lex().value,
        args: [expr, this.parseLogicalANDExpr()],
      };
    }

    return expr;
  }

  private parseLogicalANDExpr(): BinaryExpression | Expression {
    let expr = this.parseEqualityExpr();

    while (this.match('&&')) {
      expr = {
        type: SyntaxType.LOGICAL_EXPR,
        op: this.lex().value,
        args: [expr, this.parseEqualityExpr()],
      };
    }

    return expr;
  }

  private parseEqualityExpr(): BinaryExpression | Expression {
    let expr = this.parseRelationalExpr();

    while (
      this.match('==') ||
      this.match('!=') ||
      this.match('===') ||
      this.match('!==') ||
      this.match('^==') ||
      this.match('==^') ||
      this.match('^=') ||
      this.match('=^') ||
      this.match('$==') ||
      this.match('==$') ||
      this.match('$=') ||
      this.match('=$') ||
      this.match('*==') ||
      this.match('==*') ||
      this.match('*=') ||
      this.match('=*')
    ) {
      expr = {
        type: SyntaxType.COMPARISON_EXPR,
        op: this.lex().value,
        args: [expr, this.parseEqualityExpr()],
      };
    }

    return expr;
  }

  private parseRelationalExpr(): BinaryExpression | Expression {
    let expr = this.parseAdditiveExpr();

    while (this.match('<') || this.match('>') || this.match('<=') || this.match('>=')) {
      expr = {
        type: SyntaxType.COMPARISON_EXPR,
        op: this.lex().value,
        args: [expr, this.parseRelationalExpr()],
      };
    }

    return expr;
  }

  private parseAdditiveExpr(): BinaryExpression | Expression {
    let expr = this.parseMultiplicativeExpr();

    while (this.match('+') || this.match('-')) {
      expr = {
        type: SyntaxType.MATH_EXPR,
        op: this.lex().value,
        args: [expr, this.parseMultiplicativeExpr()],
      };
    }

    return expr;
  }

  private parseMultiplicativeExpr(): BinaryExpression | Expression {
    let expr: Expression = this.parseUnaryExpr();

    while (this.match('*') || this.match('/') || this.match('%')) {
      expr = {
        type: SyntaxType.MATH_EXPR,
        op: this.lex().value as string,
        args: [expr, this.parseMultiplicativeExpr()],
      };
    }

    return expr;
  }

  private parsePosExpr(): PosExpression {
    if (this.match(':')) {
      this.lex();
      return {
        type: SyntaxType.POS_EXPR,
        toIdx: this.parseLogicalORExpr(),
      };
    }

    let fromExpr = this.parseLogicalORExpr();
    if (this.match(':')) {
      this.lex();
      if (this.match(']')) {
        return {
          type: SyntaxType.POS_EXPR,
          fromIdx: fromExpr,
        };
      }

      return {
        type: SyntaxType.POS_EXPR,
        fromIdx: fromExpr,
        toIdx: this.parseLogicalORExpr(),
      };
    }

    return {
      type: SyntaxType.POS_EXPR,
      idx: fromExpr,
    };
  }

  private parseUnaryExpr(): UnaryExpression | Expression {
    if (this.match('!') || this.match('-') || this.match('...')) {
      return {
        type: SyntaxType.UNARY_EXPR,
        op: this.lex().value as string,
        arg: this.parseUnaryExpr(),
      };
    }

    return this.parsePrimaryExpr();
  }

  private parseLiteralExpr(): LiteralExpression {
    return {
      type: SyntaxType.LITERAL,
      value: this.lex().value,
    };
  }

  private parsePathVariable(): string {
    const idParts: string[] = [];
    while (this.matchID()) {
      idParts.push(this.lex().value);
      if (this.match('.')) {
        this.lex();
      }
    }
    if (!idParts.length) {
      JsonTemplateParser.throwUnexpected(this.lex());
    }
    return idParts.join('.');
  }

  private parseAssignmentExpr(): AssignmentExpression {
    this.expectTokenType(TokenType.ASSIGNMENT);
    const id = this.parsePathVariable();
    this.expect('=');

    return {
      type: SyntaxType.ASSIGNMENT_EXPR,
      id,
      value: this.parseLogicalORExpr(),
    };
  }

  private parseFunctionCallExpr(): FunctionCallExpression {
    this.expectTokenType(TokenType.FUNCTION_CALL);
    const id = this.parsePathVariable();
    const args: Expression[] = [];
    this.expect('(');
    while (!this.match(')')) {
      args.push(this.parseLogicalORExpr());
      if (!this.match(')')) {
        this.expect(',');
      }
    }
    this.expect(')');
    return {
      type: SyntaxType.FUNCTION_CALL_EXPR,
      id,
      args,
    };
  }

  private parsePrimaryExpr(): Expression {
    if (this.matchEOT() || this.match(';')) {
      return EMPTY_EXPR;
    }

    let token = this.lookahead();

    if (token.type === TokenType.ASSIGNMENT) {
      return this.parseAssignmentExpr();
    }

    if (token.type === TokenType.FUNCTIION) {
      return this.parseFunctionExpr();
    }

    if (token.type === TokenType.FUNCTION_CALL) {
      return this.parseFunctionCallExpr();
    }

    if (JsonTemplateParser.isLiteralToken(token)) {
      return this.parseLiteralExpr();
    }

    if (this.matchSelector()) {
      return this.parsePathConcatExpr();
    }

    if (this.matchPath()) {
      return this.parsePath();
    }

    if (this.match('(')) {
      return this.parseGroupExpr();
    }

    if (this.match('{')) {
      return this.parseObjectExpr();
    }

    if (this.match('[')) {
      return this.parseArrayExpr();
    }

    return JsonTemplateParser.throwUnexpected(this.lex());
  }

  private parseFunctionExpr(): FunctionExpression {
    this.expectTokenType(TokenType.FUNCTIION);
    this.expect('(');
    const params: string[] = [];
    while (!this.match(')')) {
      const token = this.lookahead();
      if (token.type !== TokenType.ID) {
        JsonTemplateParser.throwUnexpected(token);
      }
      params.push(this.lex().value);
      if (!this.match(')')) {
        this.expect(',');
      }
    }
    this.expect(')');
    this.expect('{');
    const body = this.parseStatementsExpr();
    this.expect('}');
    return {
      type: SyntaxType.FUNCTION_EXPR,
      params,
      body,
    };
  }

  private parseObjectExpr(): ObjectExpression {
    this.expect('{');
    const props: Dictionary<Expression> = {};
    while (!this.match('}')) {
      const token = this.lookahead();
      if (token.type !== TokenType.STR && token.type !== TokenType.ID) {
        JsonTemplateParser.throwUnexpected(token);
      }
      const name = this.lex().value;
      this.expect(':');
      const value = this.parseLogicalANDExpr();
      props[name] = value;
      if (!this.match('}')) {
        this.expect(',');
      }
    }
    this.expect('}');
    return { type: SyntaxType.OBJECT_EXPR, props };
  }

  private parseArrayExpr(): ArrayExpression {
    this.expect('[');
    const elements: Expression[] = [];
    while (!this.match(']')) {
      const expr = this.parseLogicalANDExpr();
      elements.push(expr);
      if (!this.match(']')) {
        this.expect(',');
      }
    }
    this.expect(']');
    return { type: SyntaxType.ARRAY_EXPR, elements };
  }

  private parseGroupExpr(): Expression {
    this.expect('(');
    let expr = this.parseLogicalORExpr();
    this.expect(')');

    return expr;
  }

  private match(value): boolean {
    let token = this.lookahead();
    return token.type === TokenType.PUNCT && token.value === value;
  }

  private matchPath(): boolean {
    return this.matchSelector() || this.matchID() || this.match('^');
  }

  private matchSelector(): boolean {
    let token = this.lookahead();
    if (token.type === TokenType.PUNCT) {
      let value = token.value;
      return value === '.' || value === '..';
    }

    return false;
  }

  private matchTokenType(tokenType: TokenType): boolean {
    let token = this.lookahead();
    return token.type === tokenType;
  }

  private matchToken(matchToken: Token): boolean {
    let token = this.lookahead();
    return token.type === matchToken.type && token.value === matchToken.value;
  }

  private matchID(): boolean {
    return this.matchTokenType(TokenType.ID);
  }

  private matchEOT(): boolean {
    return this.matchTokenType(TokenType.EOT);
  }

  private expectTokenType(tokenType: TokenType) {
    let token = this.lex();
    if (token.type !== tokenType) {
      JsonTemplateParser.throwUnexpected(token);
    }
  }

  private expect(value) {
    let token = this.lex();
    if (token.type !== TokenType.PUNCT || token.value !== value) {
      JsonTemplateParser.throwUnexpected(token);
    }
  }

  lookahead(): Token {
    if (this.buf !== undefined) {
      return this.buf;
    }

    let pos = this.idx;
    this.buf = this.advance();
    this.idx = pos;

    return this.buf;
  }

  private advance(): Token {
    while (JsonTemplateParser.isWhiteSpace(this.codeChars[this.idx])) {
      ++this.idx;
    }

    if (this.idx >= this.codeChars.length) {
      return {
        type: TokenType.EOT,
        range: [this.idx, this.idx],
      };
    }

    let token = this.scanPunctuator() || this.scanID() || this.scanString() || this.scanNumeric();
    if (token) {
      return token;
    }

    // Invalid Token
    token = { range: [this.idx, this.idx], type: TokenType.UNKNOWN };
    if (this.idx >= this.codeChars.length) {
      token.type = TokenType.EOT;
    } else {
      token.value = this.codeChars[this.idx];
    }

    JsonTemplateParser.throwUnexpected(token);
  }

  private lex(): Token {
    let token;

    if (this.buf) {
      this.idx = this.buf.range[1];
      token = this.buf;
      this.buf = undefined;
      return token;
    }

    return this.advance();
  }

  private static isDigit(ch: string) {
    return '0123456789'.indexOf(ch) >= 0;
  }

  private static isWhiteSpace(ch: string) {
    return ' \r\n\t'.indexOf(ch) > -1;
  }

  private static isIdStart(ch: string) {
    return (
      ch === '$' || ch === '@' || ch === '_' || (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')
    );
  }

  private static isIdPart(ch: string) {
    return this.isIdStart(ch) || (ch >= '0' && ch <= '9');
  }

  private static validateIDToken(token) {
    if (/^__\d+(\.|$)/.test(token.value)) {
      this.throwError(token, MESSAGES.RESERVED_ID, token.value);
    }
    if (token.value.endsWith('.')) {
      this.throwError(token, MESSAGES.INVALID_ID, token.value);
    }
  }

  private scanID(): Token | undefined {
    let ch = this.codeChars[this.idx];

    if (!JsonTemplateParser.isIdStart(ch)) {
      return;
    }

    let start = this.idx,
      id = ch;

    while (++this.idx < this.codeChars.length) {
      ch = this.codeChars[this.idx];
      if (!JsonTemplateParser.isIdPart(ch)) {
        break;
      }
      id += ch;
    }

    switch (id) {
      case 'true':
      case 'false':
        return {
          type: TokenType.BOOL,
          value: id === 'true',
          range: [start, this.idx],
        };

      case 'null':
        return {
          type: TokenType.NULL,
          value: null,
          range: [start, this.idx],
        };

      case 'set':
        return {
          type: TokenType.ASSIGNMENT,
          range: [start, this.idx],
        };

      case 'function':
        return {
          type: TokenType.FUNCTIION,
          value: 'function',
          range: [start, this.idx],
        };

      case 'call':
        return {
          type: TokenType.FUNCTION_CALL,
          value: 'call',
          range: [start, this.idx],
        };

      default:
        const token: Token = {
          type: TokenType.ID,
          value: id.replace(/^\$/, 'bindings.'),
          range: [start, this.idx],
        };
        JsonTemplateParser.validateIDToken(token);
        return token;
    }
  }

  private scanString(): Token | undefined {
    if (this.codeChars[this.idx] !== '"' && this.codeChars[this.idx] !== "'") {
      return;
    }

    let orig = this.codeChars[this.idx],
      start = ++this.idx,
      str = '',
      eosFound = false,
      ch;

    while (this.idx < this.codeChars.length) {
      ch = this.codeChars[this.idx++];
      if (ch === '\\') {
        ch = this.codeChars[this.idx++];
      } else if ((ch === '"' || ch === "'") && ch === orig) {
        eosFound = true;
        break;
      }
      str += ch;
    }

    if (eosFound) {
      return {
        type: TokenType.STR,
        value: str,
        range: [start, this.idx],
      };
    }
  }

  private scanNumeric(): Token | undefined {
    let start = this.idx,
      ch = this.codeChars[this.idx],
      isFloat = ch === '.';

    if (isFloat || JsonTemplateParser.isDigit(ch)) {
      let num = ch;
      while (++this.idx < this.codeChars.length) {
        ch = this.codeChars[this.idx];
        if (ch === '.') {
          if (isFloat) {
            return;
          }
          isFloat = true;
        } else if (!JsonTemplateParser.isDigit(ch)) {
          break;
        }

        num += ch;
      }

      return {
        type: TokenType.NUM,
        value: isFloat ? parseFloat(num) : parseInt(num, 10),
        range: [start, this.idx],
      };
    }
  }

  private scanPunctuatorForDots(): Token | undefined {
    let start = this.idx,
      ch1 = this.codeChars[this.idx],
      ch2 = this.codeChars[this.idx + 1],
      ch3 = this.codeChars[this.idx + 2];

    if (ch1 !== '.') {
      return;
    }

    if (ch2 === '.' && ch3 === '.') {
      this.idx = this.idx + 3;
      return {
        type: TokenType.PUNCT,
        value: '...',
        range: [start, this.idx],
      };
    } else if (ch2 === '.') {
      this.idx = this.idx + 2;
      return {
        type: TokenType.PUNCT,
        value: '..',
        range: [start, this.idx],
      };
    } else {
      if (JsonTemplateParser.isDigit(ch2)) {
        return;
      }
      return {
        type: TokenType.PUNCT,
        value: '.',
        range: [start, ++this.idx],
      };
    }
  }
  private scanPunctuatorForEquality(): Token | undefined {
    let start = this.idx,
      ch1 = this.codeChars[this.idx],
      ch2 = this.codeChars[this.idx + 1],
      ch3 = this.codeChars[this.idx + 2];
    if (ch2 === '=') {
      if (ch3 === '=') {
        if ('=!^$*'.indexOf(ch1) >= 0) {
          this.idx += 3;
          return {
            type: TokenType.PUNCT,
            value: ch1 + ch2 + ch3,
            range: [start, this.idx],
          };
        }
      } else if ('^$*'.indexOf(ch3) >= 0) {
        if (ch1 === '=') {
          this.idx += 3;
          return {
            type: TokenType.PUNCT,
            value: ch1 + ch2 + ch3,
            range: [start, this.idx],
          };
        }
      } else if ('=!^$*><'.indexOf(ch1) >= 0) {
        this.idx += 2;
        return {
          type: TokenType.PUNCT,
          value: ch1 + ch2,
          range: [start, this.idx],
        };
      }
    } else if (ch1 === '=') {
      if ('^$*'.indexOf(ch2) >= 0) {
        this.idx += 2;
        return {
          type: TokenType.PUNCT,
          value: ch1 + ch2,
          range: [start, this.idx],
        };
      } else {
        return {
          type: TokenType.PUNCT,
          value: ch1,
          range: [start, ++this.idx],
        };
      }
    }
  }

  private scanPunctuatorForLogicalTokens(): Token | undefined {
    let start = this.idx,
      ch1 = this.codeChars[this.idx],
      ch2 = this.codeChars[this.idx + 1];

    if (ch1 === ch2 && (ch1 === '|' || ch1 === '&')) {
      this.idx += 2;
      return {
        type: TokenType.PUNCT,
        value: ch1 + ch2,
        range: [start, this.idx],
      };
    }
  }

  private scanSingleCharPunctuators(): Token | undefined {
    let start = this.idx,
      ch1 = this.codeChars[this.idx];

    if (',;:{}()[]^+-*/%!><|'.indexOf(ch1) >= 0) {
      return {
        type: TokenType.PUNCT,
        value: ch1,
        range: [start, ++this.idx],
      };
    }
  }

  private scanPunctuator(): Token | undefined {
    return (
      this.scanPunctuatorForDots() ||
      this.scanPunctuatorForLogicalTokens() ||
      this.scanPunctuatorForEquality() ||
      this.scanSingleCharPunctuators()
    );
  }
}
