export class JsonTemplateLexerError extends Error {
  readonly column: number;
  constructor(message: string, column: number) {
    super(message);
    this.column = column;
  }
}

export class JsosTemplateParserError extends Error {
  constructor(message: string) {
    super(message);
  }
}
