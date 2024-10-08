import { VARS_PREFIX } from './constants';
import { JsonTemplateLexerError } from './errors/lexer';
import { Keyword, Token, TokenType } from './types';

const MESSAGES = {
  RESERVED_ID: 'Reserved ID pattern "%0"',
  UNEXP_TOKEN: 'Unexpected token "%0"',
  UNKNOWN_TOKEN: 'Unknown token',
  UNEXP_EOT: 'Unexpected end of template',
};

export class JsonTemplateLexer {
  private readonly codeChars: string[];

  private buf: Token[];

  private idx = 0;

  constructor(template: string) {
    this.buf = [];
    this.codeChars = template.split('');
  }

  init() {
    this.idx = 0;
    this.buf = [];
  }

  currentIndex(): number {
    return this.idx;
  }

  reset(idx: number) {
    this.idx = idx;
    this.buf = [];
  }

  getCode(start: number, end: number): string {
    return this.codeChars.slice(start, end).join('');
  }

  match(value?: string, steps = 0): boolean {
    if (!value) {
      return false;
    }
    const token = this.lookahead(steps);
    return token.type === TokenType.PUNCT && token.value === value;
  }

  matchAssignment(): boolean {
    return (
      this.match('=') ||
      this.match('+=') ||
      this.match('-=') ||
      this.match('*=') ||
      this.match('/=')
    );
  }

  matchLiteral(): boolean {
    return JsonTemplateLexer.isLiteralToken(this.lookahead());
  }

  matchTemplate(): boolean {
    return this.matchTokenType(TokenType.TEMPLATE);
  }

  matchINT(steps = 0): boolean {
    return this.matchTokenType(TokenType.INT, steps);
  }

  matchToArray(): boolean {
    return this.match('[') && this.match(']', 1);
  }

  matchCompileTimeExpr(): boolean {
    return this.match('{') && this.match('{', 1);
  }

  matchMappings(): boolean {
    return this.match('~m');
  }

  matchSimplePath(): boolean {
    return this.match('~s');
  }

  matchRichPath(): boolean {
    return this.match('~r');
  }

  matchJsonPath(): boolean {
    return this.match('~j');
  }

  matchPathType(): boolean {
    return this.matchRichPath() || this.matchJsonPath() || this.matchSimplePath();
  }

  matchPath(): boolean {
    return this.matchPathSelector() || this.matchID();
  }

  matchObjectContextProp(): boolean {
    return this.match('@') && this.matchID(1);
  }

  matchSpread(): boolean {
    return this.match('...');
  }

  matchIncrement(): boolean {
    return this.match('++');
  }

  matchDecrement(): boolean {
    return this.match('--');
  }

  matchPathPartSelector(): boolean {
    const token = this.lookahead();
    if (token.type === TokenType.PUNCT) {
      return token.value === '.' || token.value === '..';
    }
    return false;
  }

  matchPathSelector(): boolean {
    const token = this.lookahead();
    if (token.type === TokenType.PUNCT) {
      const { value } = token;
      return value === '.' || value === '..' || value === '^' || value === '@';
    }

    return false;
  }

  matchTokenType(tokenType: TokenType, steps: number = 0): boolean {
    const token = this.lookahead(steps);
    return token.type === tokenType;
  }

  matchID(steps: number = 0): boolean {
    return this.matchTokenType(TokenType.ID, steps);
  }

  matchEOT(): boolean {
    return this.matchTokenType(TokenType.EOT);
  }

  private static isOperator(id: string): boolean {
    return Object.values(Keyword).some((op) => op.toString() === id);
  }

  matchKeyword(): boolean {
    return this.matchTokenType(TokenType.KEYWORD);
  }

  matchKeywordValue(val: string): boolean {
    const token = this.lookahead();
    return token.type === TokenType.KEYWORD && token.value === val;
  }

  matchContains(): boolean {
    return this.matchKeywordValue(Keyword.CONTAINS);
  }

  matchEmpty(): boolean {
    return this.matchKeywordValue(Keyword.EMPTY);
  }

  matchSize(): boolean {
    return this.matchKeywordValue(Keyword.SIZE);
  }

  matchSubsetOf(): boolean {
    return this.matchKeywordValue(Keyword.SUBSETOF);
  }

  matchAnyOf(): boolean {
    return this.matchKeywordValue(Keyword.ANYOF);
  }

  matchNoneOf(): boolean {
    return this.matchKeywordValue(Keyword.NONEOF);
  }

  matchIN(): boolean {
    return this.matchKeywordValue(Keyword.IN);
  }

  matchNotIN(): boolean {
    return this.matchKeywordValue(Keyword.NOT_IN);
  }

  matchFunction(): boolean {
    return this.matchKeywordValue(Keyword.FUNCTION);
  }

  matchNew(): boolean {
    return this.matchKeywordValue(Keyword.NEW);
  }

  matchTypeOf(): boolean {
    return this.matchKeywordValue(Keyword.TYPEOF);
  }

  matchAwait(): boolean {
    return this.matchKeywordValue(Keyword.AWAIT);
  }

  matchLambda(): boolean {
    return this.matchKeywordValue(Keyword.LAMBDA);
  }

  expect(value) {
    const token = this.lex();
    if (token.type !== TokenType.PUNCT || token.value !== value) {
      this.throwUnexpectedToken(token);
    }
  }

  lookahead(steps: number = 0): Token {
    if (this.buf[steps] !== undefined) {
      return this.buf[steps];
    }

    const pos = this.idx;
    if (this.buf.length) {
      // eslint-disable-next-line prefer-destructuring
      this.idx = this.buf[this.buf.length - 1].range[1];
    }
    for (let i = this.buf.length; i <= steps; i += 1) {
      this.buf.push(this.advance());
    }
    this.idx = pos;

    return this.buf[steps];
  }

  private isLineCommentStart(): boolean {
    return this.codeChars[this.idx] === '/' && this.codeChars[this.idx + 1] === '/';
  }

  private isLineCommentEnd(): boolean {
    return this.idx >= this.codeChars.length || this.codeChars[this.idx] === '\n';
  }

  private isBlockCommentStart(): boolean {
    return this.codeChars[this.idx] === '/' && this.codeChars[this.idx + 1] === '*';
  }

  private isBlockCommentEnd(): boolean {
    return this.codeChars[this.idx] === '*' && this.codeChars[this.idx + 1] === '/';
  }

  private skipLineComment() {
    if (!this.isLineCommentStart()) {
      return;
    }
    while (!this.isLineCommentEnd()) {
      ++this.idx;
    }
    ++this.idx;
  }

  private skipBlockComment() {
    if (!this.isBlockCommentStart()) {
      return;
    }
    while (!this.isBlockCommentEnd()) {
      ++this.idx;
    }
    this.idx += 2;
  }

  private isWhiteSpace() {
    return ' \r\n\t'.includes(this.codeChars[this.idx]);
  }

  private skipWhitespace() {
    while (this.isWhiteSpace()) {
      ++this.idx;
    }
  }

  private skipInput() {
    while (this.isWhiteSpace() || this.isBlockCommentStart() || this.isLineCommentStart()) {
      this.skipWhitespace();
      this.skipLineComment();
      this.skipBlockComment();
    }
  }

  private advance(): Token {
    this.skipInput();

    if (this.idx >= this.codeChars.length) {
      return {
        type: TokenType.EOT,
        range: [this.idx, this.idx],
        value: undefined,
      };
    }

    const token =
      this.scanRegularExpressions() ??
      this.scanPunctuator() ??
      this.scanID() ??
      this.scanString() ??
      this.scanInteger();
    if (token) {
      return token;
    }
    JsonTemplateLexer.throwError(MESSAGES.UNKNOWN_TOKEN);
  }

  value(): any {
    return this.lex().value;
  }

  ignoreTokens(numTokens: number) {
    for (let i = 0; i < numTokens; i++) {
      this.lex();
    }
  }

  lex(): Token {
    if (this.buf[0]) {
      // eslint-disable-next-line prefer-destructuring
      this.idx = this.buf[0].range[1];
      const token = this.buf[0];
      this.buf = this.buf.slice(1);
      return token;
    }
    return this.advance();
  }

  static isLiteralToken(token: Token) {
    return (
      token.type === TokenType.BOOL ||
      token.type === TokenType.INT ||
      token.type === TokenType.FLOAT ||
      token.type === TokenType.STR ||
      token.type === TokenType.NULL ||
      token.type === TokenType.UNDEFINED ||
      token.type === TokenType.REGEXP
    );
  }

  throwUnexpectedToken(token?: Token): never {
    const newToken = token ?? this.lookahead();
    if (newToken.type === TokenType.EOT) {
      JsonTemplateLexer.throwError(MESSAGES.UNEXP_EOT);
    }

    JsonTemplateLexer.throwError(MESSAGES.UNEXP_TOKEN, newToken.value);
  }

  private static throwError(messageFormat: string, ...args): never {
    const msg = messageFormat.replace(/%(\d)/g, (_, idx) => args[idx]);
    throw new JsonTemplateLexerError(msg);
  }

  private static isDigit(ch: string) {
    return '0123456789'.indexOf(ch) >= 0;
  }

  private static isIdStart(ch: string) {
    return ch === '_' || ch === '$' || (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');
  }

  private static isIdPart(ch: string) {
    return this.isIdStart(ch) || (ch >= '0' && ch <= '9');
  }

  private static validateID(id: string) {
    if (id.startsWith(VARS_PREFIX)) {
      JsonTemplateLexer.throwError(MESSAGES.RESERVED_ID, id);
    }
  }

  private scanID(): Token | undefined {
    let ch = this.codeChars[this.idx];

    if (!JsonTemplateLexer.isIdStart(ch)) {
      return;
    }

    const start = this.idx;
    let id = ch;

    while (++this.idx < this.codeChars.length) {
      ch = this.codeChars[this.idx];
      if (!JsonTemplateLexer.isIdPart(ch)) {
        break;
      }
      id += ch;
    }

    if (JsonTemplateLexer.isOperator(id)) {
      return {
        type: TokenType.KEYWORD,
        value: id,
        range: [start, this.idx],
      };
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

      case 'undefined':
        return {
          type: TokenType.UNDEFINED,
          value: undefined,
          range: [start, this.idx],
        };

      default:
        JsonTemplateLexer.validateID(id);
        return {
          type: TokenType.ID,
          value: id,
          range: [start, this.idx],
        };
    }
  }

  private scanString(): Token | undefined {
    if (
      this.codeChars[this.idx] !== '"' &&
      this.codeChars[this.idx] !== '`' &&
      this.codeChars[this.idx] !== "'"
    ) {
      return;
    }

    const orig = this.codeChars[this.idx];
    const start = ++this.idx;
    let str = '';
    let eosFound = false;
    let ch;

    while (this.idx < this.codeChars.length) {
      ch = this.codeChars[this.idx++];
      if (ch === '\\') {
        ch = this.codeChars[this.idx++];
      } else if ('\'"`'.includes(ch) && ch === orig) {
        eosFound = true;
        break;
      }
      str += ch;
    }

    if (eosFound) {
      return {
        type: orig === '`' ? TokenType.TEMPLATE : TokenType.STR,
        value: str,
        range: [start, this.idx],
      };
    }
    this.throwUnexpectedToken();
  }

  scanInteger(): Token | undefined {
    const start = this.idx;
    let ch = this.codeChars[this.idx];
    if (!JsonTemplateLexer.isDigit(ch)) {
      return;
    }
    let num = ch;
    while (++this.idx < this.codeChars.length) {
      ch = this.codeChars[this.idx];
      if (!JsonTemplateLexer.isDigit(ch)) {
        break;
      }
      num += ch;
    }
    return {
      type: TokenType.INT,
      value: num,
      range: [start, this.idx],
    };
  }

  private scanPunctuatorForDots(): Token | undefined {
    const start = this.idx;
    const ch1 = this.codeChars[this.idx];
    const ch2 = this.codeChars[this.idx + 1];
    const ch3 = this.codeChars[this.idx + 2];

    if (ch1 !== '.') {
      return;
    }

    if (ch2 === '(' && ch3 === ')') {
      this.idx += 3;
      return {
        type: TokenType.PUNCT,
        value: '.()',
        range: [start, this.idx],
      };
    }
    if (ch2 === '.' && ch3 === '.') {
      this.idx += 3;
      return {
        type: TokenType.PUNCT,
        value: '...',
        range: [start, this.idx],
      };
    }
    if (ch2 === '.') {
      this.idx += 2;
      return {
        type: TokenType.PUNCT,
        value: '..',
        range: [start, this.idx],
      };
    }
    return {
      type: TokenType.PUNCT,
      value: '.',
      range: [start, ++this.idx],
    };
  }

  private scanPunctuatorForEquality(): Token | undefined {
    const start = this.idx;
    const ch1 = this.codeChars[this.idx];
    const ch2 = this.codeChars[this.idx + 1];
    const ch3 = this.codeChars[this.idx + 2];

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
      } else if ('=!^$><'.indexOf(ch1) >= 0) {
        this.idx += 2;
        return {
          type: TokenType.PUNCT,
          value: ch1 + ch2,
          range: [start, this.idx],
        };
      }
    } else if (ch1 === '=') {
      if ('^$*~'.indexOf(ch2) >= 0) {
        this.idx += 2;
        return {
          type: TokenType.PUNCT,
          value: ch1 + ch2,
          range: [start, this.idx],
        };
      }
      return {
        type: TokenType.PUNCT,
        value: ch1,
        range: [start, ++this.idx],
      };
    }
  }

  private scanPunctuatorForRepeatedTokens(
    validSymbols: string,
    numRepeations = 2,
  ): Token | undefined {
    const start = this.idx;
    const ch = this.codeChars[this.idx];
    let tokenVal = ch;
    for (let i = 1; i < numRepeations; i++) {
      if (this.codeChars[this.idx + i] !== ch) {
        return;
      }
      tokenVal += ch;
    }

    if (validSymbols.includes(ch)) {
      this.idx += numRepeations;
      return {
        type: TokenType.PUNCT,
        value: tokenVal,
        range: [start, this.idx],
      };
    }
  }

  private scanSingleCharPunctuators(): Token | undefined {
    const start = this.idx;
    const ch1 = this.codeChars[this.idx];

    if (',;:{}()[]^+-*/%!><|=@~#?\n'.includes(ch1)) {
      return {
        type: TokenType.PUNCT,
        value: ch1,
        range: [start, ++this.idx],
      };
    }
  }

  private scanPunctuatorForQuestionMarks(): Token | undefined {
    const start = this.idx;
    const ch1 = this.codeChars[this.idx];
    const ch2 = this.codeChars[this.idx + 1];

    if (ch1 === '?' && JsonTemplateLexer.isDigit(ch2)) {
      this.idx += 2;
      return {
        type: TokenType.LAMBDA_ARG,
        value: Number(ch2),
        range: [start, this.idx],
      };
    }
  }

  private scanPunctuatorForPaths(): Token | undefined {
    const start = this.idx;
    const ch1 = this.codeChars[this.idx];
    const ch2 = this.codeChars[this.idx + 1];

    if (ch1 === '~' && 'rsjm'.includes(ch2)) {
      this.idx += 2;
      return {
        type: TokenType.PUNCT,
        value: ch1 + ch2,
        range: [start, this.idx],
      };
    }
  }

  private scanPunctuatorForArithmeticAssignment(): Token | undefined {
    const start = this.idx;
    const ch1 = this.codeChars[this.idx];
    const ch2 = this.codeChars[this.idx + 1];
    if ('+-/*'.includes(ch1) && ch2 === '=') {
      this.idx += 2;
      return {
        type: TokenType.PUNCT,
        value: ch1 + ch2,
        range: [start, this.idx],
      };
    }
  }

  private static isValidRegExp(regexp: string, modifiers: string) {
    try {
      RegExp(regexp, modifiers);
      return true;
    } catch (e) {
      return false;
    }
  }

  private getRegExpModifiers(): string {
    let modifiers = '';
    while ('gimsuyv'.includes(this.codeChars[this.idx])) {
      modifiers += this.codeChars[this.idx];
      this.idx++;
    }
    return modifiers;
  }

  private scanRegularExpressions(): Token | undefined {
    const start = this.idx;
    const ch1 = this.codeChars[this.idx];

    if (ch1 === '/') {
      let end = this.idx + 1;
      while (end < this.codeChars.length) {
        if (this.codeChars[end] === '\n') {
          return;
        }
        if (this.codeChars[end] === '/') {
          break;
        }
        end++;
      }

      if (end < this.codeChars.length) {
        this.idx = end + 1;
        const regexp = this.getCode(start + 1, end);
        const modifiers = this.getRegExpModifiers();
        if (!JsonTemplateLexer.isValidRegExp(regexp, modifiers)) {
          JsonTemplateLexer.throwError("invalid regular expression '%0'", regexp);
        }
        return {
          type: TokenType.REGEXP,
          value: this.getCode(start, this.idx),
          range: [start, this.idx],
        };
      }
    }
  }

  private scanPunctuator(): Token | undefined {
    return (
      this.scanPunctuatorForDots() ??
      this.scanPunctuatorForQuestionMarks() ??
      this.scanPunctuatorForArithmeticAssignment() ??
      this.scanPunctuatorForEquality() ??
      this.scanPunctuatorForPaths() ??
      this.scanPunctuatorForRepeatedTokens('?', 3) ??
      this.scanPunctuatorForRepeatedTokens('|&*.=>?<+-', 2) ??
      this.scanSingleCharPunctuators()
    );
  }
}
