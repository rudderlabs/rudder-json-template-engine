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
  PosFilterExpression,
  Keyword,
  FunctionCallArgExpression,
  ConditionalExpression,
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
    const expr = this.parseConditionalExpr();
    if (expr.type === SyntaxType.PATH && this.lexer.match('=')) {
      this.lexer.lex();
      return {
        type: SyntaxType.ASSIGNMENT_EXPR,
        value: this.parseConditionalExpr(),
        id: JsonTemplateParser.getIDPath(expr as PathExpression),
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
      operands.unshift(expr);
      return {
        type: SyntaxType.CONCAT_EXPR,
        args: operands,
      }
    }

    return expr;
  }

  private parsePathConcatPartExpr(): Expression {
    return this.lexer.match('(') ? this.parsePathGroupExpr() : this.parsePath();
  }

  private parsePathGroupExpr(): Expression {
    this.lexer.expect('(');
    let expr = this.parseConditionalExpr();
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

  private parsePath(): PathExpression {
    if (!this.lexer.matchPath()) {
      this.lexer.throwUnexpected();
    }

    let root: string | undefined;
    let parts: Expression[] = [];

    if (this.lexer.match('^')) {
      this.lexer.lex();
      root = DATA_PARAM_KEY;
    } else if (this.lexer.matchID()) {
      const idPath = this.parsePathVariable();
      if (this.lexer.match('(')) {
        parts.push(this.parseFunctionCallExpr(idPath))
      } else {
        root = idPath;
      }
    }

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
    if (this.lexer.match('(') ||
      (this.lexer.match('.') && this.lexer.matchID(1) && this.lexer.match('(', 2))
    ) {
      return this.parseFunctionCallExpr();
    } else if (this.lexer.matchSelector()) {
      return this.parseSelector();
    } else if (this.lexer.match('[')) {
      return this.parseFilterExpr();
    }
  }

  private parseSelector(): SelectorExpression | Expression {
    let selector = this.lexer.lex().value;
    let prop: string | undefined;

    if (this.lexer.match('*') ||
      this.lexer.matchID() ||
      this.lexer.matchTokenType(TokenType.STR)) {
      prop = this.lexer.lex().value;
    }

    return {
      type: SyntaxType.SELECTOR,
      selector: selector,
      prop
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
        toIdx: this.parseConditionalExpr(),
      };
    }

    let fromExpr = this.parseConditionalExpr();
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
        toIdx: this.parseConditionalExpr(),
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
      filters.push(this.parseConditionalExpr());
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

  private parseConditionalExpr(): ConditionalExpression | Expression {
    let expr = this.parseLogicalORExpr();

    while (this.lexer.match('?')) {
      let successExpr = this.parseLogicalORExpr();
      while (this.lexer.match(':')) {
        expr = {
          type: SyntaxType.CONDITIONAL_EXPR,
          args: [expr, successExpr, this.parseLogicalORExpr()],
        };
      }
    }

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
        op: this.lexer.lex().value,
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
        op: this.lexer.lex().value,
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
        op: this.lexer.lex().value,
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
        op: this.lexer.lex().value as string,
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
        op: this.lexer.lex().value as string,
        args: [expr, this.parsePowerExpr()],
      };
    }

    return expr;
  }

  private parseUnaryExpr(): UnaryExpression | Expression {
    if (this.lexer.match('!') ||
      this.lexer.match('-') ||
      this.lexer.matchTypeOf()) {
      return {
        type: SyntaxType.UNARY_EXPR,
        op: this.lexer.lex().value as string,
        arg: this.parseComplexExpr(),
      };
    }

    return this.parseComplexExpr();
  }

  private parseComplexExpr(): PathExpression | Expression {
    const expr = this.parsePrimaryExpr();
    if(this.lexer.match('.') || this.lexer.match('[')) {
      const pathExpr = this.parsePath();
      pathExpr.parts.unshift(expr);
      return pathExpr;
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

  private parsePathVariable(): string {
    const idParts: string[] = [];
    while (this.lexer.matchID()) {
      idParts.push(this.lexer.lex().value);
      if (this.lexer.match('.') && this.lexer.matchID(1)) {
        this.lexer.lex();
      }
    }
    if (!idParts.length) {
      this.lexer.throwUnexpected();
    }
    return idParts.join('.').replace(/^\$/, `${BINDINGS_PARAM_KEY}.`);
  }

  private parseDefinitionExpr(): AssignmentExpression {
    const operator = this.lexer.lex().value;
    if (!this.lexer.matchID()) {
      this.lexer.throwUnexpected();
    }
    const id = this.lexer.lex().value;
    this.lexer.expect('=');

    return {
      type: SyntaxType.ASSIGNMENT_EXPR,
      id,
      value: this.parseConditionalExpr(),
      operator,
    };
  }

  private parseFunctionCallArgExpr(): FunctionCallArgExpression {
    let spread: boolean = false;
    if (this.lexer.match('...')) {
      this.lexer.lex();
      spread = true;

    }
    return {
      type: SyntaxType.FUNCTION_CALL_ARG_EXPR,
      value: this.parseConditionalExpr(),
      spread
    }
  }

  private parseFunctionCallArgs(): FunctionCallArgExpression[] {
    const args: FunctionCallArgExpression[] = [];
    this.lexer.expect('(');
    while (!this.lexer.match(')')) {
      args.push(this.parseFunctionCallArgExpr());
      if (!this.lexer.match(')')) {
        this.lexer.expect(',');
      }
    }
    this.lexer.expect(')');
    return args;
  }

  private parseFunctionCallExpr(id?: string): FunctionCallExpression {
    let dot = this.lexer.match('.');
    let isNew = this.lexer.matchNew();
    if (dot || isNew) {
      this.lexer.lex();
      if (!this.lexer.matchID()) {
        this.lexer.throwUnexpected();
      }
      id = this.parsePathVariable();
    }

    return {
      type: SyntaxType.FUNCTION_CALL_EXPR,
      args: this.parseFunctionCallArgs(),
      id,
      dot,
      isNew
    };
  }

  private parsePrimaryExpr(): Expression {
    if (this.lexer.matchEOT() || this.lexer.match(';')) {
      return EMPTY_EXPR;
    }

    if (this.lexer.matchNew()) {
      return this.parseFunctionCallExpr();
    }

    if (this.lexer.matchDefinition()) {
      return this.parseDefinitionExpr();
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
      return this.parseGroupExpr();
    }

    return this.lexer.throwUnexpected();
  }

  private parseFunctionDefinitionParam(): string {
    let spread: string = '';
    if (this.lexer.match('...')) {
      this.lexer.lex();
      spread = '...';
      // rest param should be last param.
      if (!this.lexer.match(')', 1)) {
        this.lexer.throwUnexpected();
      }
    }
    if (!this.lexer.matchID()) {
      this.lexer.throwUnexpected();
    }
    return `${spread}${this.lexer.lex().value}`;
  }

  private parseFunctionDefinitionParams(): string[] {
    const params: string[] = [];
    this.lexer.expect('(');
    while (!this.lexer.match(')')) {
      params.push(this.parseFunctionDefinitionParam());
      if (!this.lexer.match(')')) {
        this.lexer.expect(',');
      }
    }
    this.lexer.expect(')');
    return params;
  }

  private parseFunctionDefinitionExpr(): FunctionExpression {
    this.lexer.expectOperator(Keyword.FUNCTION);
    const params = this.parseFunctionDefinitionParams();
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
      key = this.parseConditionalExpr();
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
      const value = this.parseConditionalExpr();
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
    let expr = this.parseConditionalExpr();
    this.lexer.expect(')');

    return expr;
  }
}
