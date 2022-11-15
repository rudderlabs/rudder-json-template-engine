import { BINDINGS_PARAM_KEY, VARS_PREFIX } from './constants';
import { JsonTemplateLexerError } from './errors';
import { Keyword, Token, TokenType } from './types';

const MESSAGES = {
  RESERVED_ID: 'Reserved ID pattern "%0"',
  UNEXP_TOKEN: 'Unexpected token "%0"',
  UNEXP_EOT: 'Unexpected end of template',
};

const BLOCK_COMMENT_REGEX = /\/\*([^*]|[\r\n]|(\*+([^*/]|[\r\n])))*\*+\//g;
const SINGLE_LINE_COMMENT_REGEX = /\/\/[^\n\r]+?(?:\*\)|[\n\r])/g;

export class JsonTemplateLexer {
  private readonly codeChars: string[];
  private buf: Token[];
  private idx = 0;
  constructor(template: string) {
    this.buf = [];
    this.codeChars = template
      .replace(BLOCK_COMMENT_REGEX, '')
      .replace(SINGLE_LINE_COMMENT_REGEX, '')
      .split('');
  }

  match(value?: string, steps = 0): boolean {
    if(!value) {
      return false;
    }
    let token = this.lookahead(steps);
    return token.type === TokenType.PUNCT && token.value === value;
  }

  matchLiteral(): boolean {
    return JsonTemplateLexer.isLiteralToken(this.lookahead());
  }

  matchPath(): boolean {
    return this.matchPathSelector() || this.matchID();
  }

  matchSpread(): boolean {
    return this.match('...');
  }

  matchPathPartSelector(): boolean {
    let token = this.lookahead();
    if (token.type === TokenType.PUNCT) {
      let value = token.value;
      return value === '.' || value === '...';
    }
    return false;
  }

  matchPathSelector(): boolean {
    let token = this.lookahead();
    if (token.type === TokenType.PUNCT) {
      let value = token.value;
      return value === '.' || value === '...' || value === '^';
    }

    return false;
  }

  matchTokenType(tokenType: TokenType, steps: number = 0): boolean {
    let token = this.lookahead(steps);
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

  matchKeyword(op: string): boolean {
    let token = this.lookahead();
    return token.type === TokenType.OPERATOR && token.value === op;
  }

  matchFunction(): boolean {
    return this.matchKeyword(Keyword.FUNCTION);
  }

  matchNew(): boolean {
    return this.matchKeyword(Keyword.NEW);
  }

  matchReturn(): boolean {
    return this.matchKeyword(Keyword.RETURN);
  }

  matchTypeOf(): boolean {
    return this.matchKeyword(Keyword.TYPEOF);
  }

  matchLambda(): boolean {
    return this.matchKeyword(Keyword.LAMBDA);
  }

  matchDefinition(): boolean {
    return this.matchKeyword(Keyword.LET) || this.matchKeyword(Keyword.CONST);
  }

  expectKeyword(op: string) {
    let token = this.lex();
    if (token.type !== TokenType.OPERATOR || token.value !== op) {
      this.throwUnexpectedToken(token);
    }
  }

  expectTokenType(tokenType: TokenType) {
    let token = this.lex();
    if (token.type !== tokenType) {
      this.throwUnexpectedToken(token);
    }
  }

  expect(value) {
    let token = this.lex();
    if (token.type !== TokenType.PUNCT || token.value !== value) {
      this.throwUnexpectedToken(token);
    }
  }

  lookahead(steps: number = 0): Token {
    if (this.buf[steps] !== undefined) {
      return this.buf[steps];
    }

    let pos = this.idx;
    if (this.buf.length) {
      this.idx = this.buf[this.buf.length - 1].range[1];
    }
    for (let i = this.buf.length; i <= steps; i++) {
      this.buf.push(this.advance());
    }
    this.idx = pos;

    return this.buf[steps];
  }

  private advance(): Token {
    while (JsonTemplateLexer.isWhiteSpace(this.codeChars[this.idx])) {
      ++this.idx;
    }

    if (this.idx >= this.codeChars.length) {
      return {
        type: TokenType.EOT,
        range: [this.idx, this.idx],
        value: undefined,
      };
    }

    let token = this.scanPunctuator() || this.scanID() || this.scanString() || this.scanNumeric();
    if (token) {
      return token;
    }

    return { range: [this.idx, this.idx], type: TokenType.UNKNOWN, value: undefined };
  }

  value(): any {
    return this.lex().value;
  }

  lex(): Token {
    let token;

    if (this.buf[0]) {
      this.idx = this.buf[0].range[1];
      token = this.buf[0];
      this.buf = this.buf.slice(1);
      return token;
    }

    return this.advance();
  }

  static isLiteralToken(token: Token) {
    return (
      token.type === TokenType.BOOL ||
      token.type === TokenType.NUM ||
      token.type === TokenType.STR ||
      token.type === TokenType.NULL
    );
  }

  throwUnexpectedToken(token?: Token): never {
    token = token || this.lookahead();
    if (token.type === TokenType.EOT) {
      this.throwError(MESSAGES.UNEXP_EOT);
    }

    this.throwError(MESSAGES.UNEXP_TOKEN, token.value);
  }

  getContext(length = 10): string {
    return this.codeChars.slice(this.idx - length, this.idx + length).join('');
  }

  private throwError(messageFormat: string, ...args): never {
    const msg = messageFormat.replace(/%(\d)/g, (_, idx) => {
      return args[idx] || '';
    });
    throw new JsonTemplateLexerError(msg + ' at ' + this.getContext(15));
  }

  private static isDigit(ch: string) {
    return '0123456789'.indexOf(ch) >= 0;
  }

  private static isWhiteSpace(ch: string) {
    return ' \r\n\t'.indexOf(ch) > -1;
  }

  private static isIdStart(ch: string) {
    return ch === '$' || ch === '_' || (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');
  }

  private static isIdPart(ch: string) {
    return this.isIdStart(ch) || (ch >= '0' && ch <= '9');
  }

  private validateID(id: string) {
    if (id.startsWith(VARS_PREFIX)) {
      this.throwError(MESSAGES.RESERVED_ID, id);
    }
  }

  private scanID(): Token | undefined {
    let ch = this.codeChars[this.idx];

    if (!JsonTemplateLexer.isIdStart(ch)) {
      return;
    }

    let start = this.idx,
      id = ch;

    while (++this.idx < this.codeChars.length) {
      ch = this.codeChars[this.idx];
      if (!JsonTemplateLexer.isIdPart(ch)) {
        break;
      }
      id += ch;
    }

    if (JsonTemplateLexer.isOperator(id)) {
      return {
        type: TokenType.OPERATOR,
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

      default:
        this.validateID(id);
        const token: Token = {
          type: TokenType.ID,
          value: id.replace(/^\$/, `${BINDINGS_PARAM_KEY}`),
          range: [start, this.idx],
        };
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

    if (isFloat || JsonTemplateLexer.isDigit(ch)) {
      let num = ch;
      while (++this.idx < this.codeChars.length) {
        ch = this.codeChars[this.idx];
        if (ch === '.') {
          if (isFloat) {
            return;
          }
          isFloat = true;
        } else if (!JsonTemplateLexer.isDigit(ch)) {
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
    } else {
      if (JsonTemplateLexer.isDigit(ch2)) {
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

  private scanPunctuatorForRepeatedTokens(): Token | undefined {
    let start = this.idx,
      ch1 = this.codeChars[this.idx],
      ch2 = this.codeChars[this.idx + 1];

    if (ch1 === ch2 && '|&*.=><'.includes(ch1)) {
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

    if (',;:{}()[]^+-*/%!><|=@~#?'.includes(ch1)) {
      return {
        type: TokenType.PUNCT,
        value: ch1,
        range: [start, ++this.idx],
      };
    }
  }

  private scanPunctuatorForShortFunctionArgs(): Token | undefined {
    let start = this.idx,
      ch1 = this.codeChars[this.idx],
      ch2 = this.codeChars[this.idx+1];

    if(ch1 === '?' && JsonTemplateLexer.isDigit(ch2)) {
      this.idx += 2;
      return {
        type: TokenType.LAMBDA_ARG,
        value: Number(ch2),
        range: [start, this.idx],
      };
    }
  }

  private scanPunctuator(): Token | undefined {
    return (
      this.scanPunctuatorForDots() ||
      this.scanPunctuatorForShortFunctionArgs() ||
      this.scanPunctuatorForEquality() ||
      this.scanPunctuatorForRepeatedTokens() ||
      this.scanSingleCharPunctuators()
    );
  }

  validateNoMoreTokensLeft() {
    const token = this.lex();

    if (token.type !== TokenType.EOT) {
      this.throwUnexpectedToken(token);
    }
  }
}
