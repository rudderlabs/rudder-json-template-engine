import { BINDINGS_PARAM_KEY, DATA_PARAM_KEY } from './constants';
import { JsonTemplateLexer } from './lexer';
import { JsonTemplateParser } from './parser';
import { JsonTemplateTranslator } from './translator';
import { EngineOptions, Expression } from './types';
import { CommonUtils } from './utils';

export class JsonTemplateEngine {
  private readonly fn: Function;

  private constructor(fn: Function) {
    this.fn = fn;
  }

  static create(templateOrExpr: string | Expression, options?: EngineOptions): JsonTemplateEngine {
    return new JsonTemplateEngine(this.compileAsAsync(templateOrExpr, options));
  }

  static createAsSync(
    templateOrExpr: string | Expression,
    options?: EngineOptions,
  ): JsonTemplateEngine {
    return new JsonTemplateEngine(this.compileAsSync(templateOrExpr, options));
  }

  private static compileAsSync(
    templateOrExpr: string | Expression,
    options?: EngineOptions,
  ): Function {
    return Function(DATA_PARAM_KEY, BINDINGS_PARAM_KEY, this.translate(templateOrExpr, options));
  }

  private static compileAsAsync(
    templateOrExpr: string | Expression,
    options?: EngineOptions,
  ): Function {
    return CommonUtils.CreateAsyncFunction(
      DATA_PARAM_KEY,
      BINDINGS_PARAM_KEY,
      this.translate(templateOrExpr, options),
    );
  }

  static parse(template: string, options?: EngineOptions): Expression {
    const lexer = new JsonTemplateLexer(template);
    const parser = new JsonTemplateParser(lexer, options);
    return parser.parse();
  }

  static translate(templateOrExpr: string | Expression, options?: EngineOptions): string {
    if (typeof templateOrExpr === 'string') {
      return this.translateTemplate(templateOrExpr, options);
    }
    return this.translateExpression(templateOrExpr);
  }

  private static translateTemplate(template: string, options?: EngineOptions): string {
    return this.translateExpression(this.parse(template, options));
  }

  private static translateExpression(expr: Expression): string {
    const translator = new JsonTemplateTranslator(expr);
    return translator.translate();
  }

  evaluate(data: any, bindings: Record<string, any> = {}): any {
    return this.fn(data || {}, bindings);
  }
}
