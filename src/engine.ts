import { BINDINGS_PARAM_KEY, DATA_PARAM_KEY } from './constants';
import { JsonTemplateLexer } from './lexer';
import { JsonTemplateParser } from './parser';
import { JsonTemplateTranslator } from './translator';
import { Expression } from './types';
import { CommonUtils } from './utils';

export class JsonTemplateEngine {
  private readonly fn: Function;
  private constructor(fn: Function) {
    this.fn = fn;
  }

  static create(
    templateOrExpr: string | Expression,
    compileTimeBindings?: any,
  ): JsonTemplateEngine {
    return new JsonTemplateEngine(this.compile(templateOrExpr, compileTimeBindings));
  }

  static createSync(
    templateOrExpr: string | Expression,
    compileTimeBindings?: any,
  ): JsonTemplateEngine {
    return new JsonTemplateEngine(this.compileSync(templateOrExpr, compileTimeBindings));
  }

  private static compileSync(
    templateOrExpr: string | Expression,
    compileTimeBindings?: any,
  ): Function {
    return Function(
      DATA_PARAM_KEY,
      BINDINGS_PARAM_KEY,
      this.translate(templateOrExpr, compileTimeBindings),
    );
  }

  private static compile(templateOrExpr: string | Expression, compileTimeBindings?: any): Function {
    return CommonUtils.CreateAsyncFunction(
      DATA_PARAM_KEY,
      BINDINGS_PARAM_KEY,
      this.translate(templateOrExpr, compileTimeBindings),
    );
  }

  static parse(template: string): Expression {
    const lexer = new JsonTemplateLexer(template);
    const parser = new JsonTemplateParser(lexer);
    return parser.parse();
  }

  static translate(templateOrExpr: string | Expression, compileTimeBindings?: any): string {
    if (typeof templateOrExpr === 'string') {
      return this.translateTemplate(templateOrExpr, compileTimeBindings);
    }
    return this.translateExpression(templateOrExpr, compileTimeBindings);
  }

  private static translateTemplate(template: string, compileTimeBindings?: any): string {
    return this.translateExpression(this.parse(template), compileTimeBindings);
  }

  private static translateExpression(expr: Expression, compileTimeBindings?: any): string {
    const translator = new JsonTemplateTranslator(expr, compileTimeBindings);
    return translator.translate();
  }

  evaluate(data: any, bindings: any = {}): any {
    return this.fn(data || {}, bindings);
  }
}
