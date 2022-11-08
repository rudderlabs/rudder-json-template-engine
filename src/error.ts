export class JsonTemplateParserError extends Error {
  readonly column: number;
  constructor(message: string, column: number) {
    super(message);
    this.column = column;
  }
}

export class JsosTemplateEngineError extends Error {
  constructor(message: string) {
    super(message);
  }
}
