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
    return new JsonTemplateEngine(this.compileAsAsync(templateOrExpr, compileTimeBindings));
  }

  static createAsSync(
    templateOrExpr: string | Expression,
    compileTimeBindings?: any,
  ): JsonTemplateEngine {
    return new JsonTemplateEngine(this.compileAsSync(templateOrExpr, compileTimeBindings));
  }

  private static compileAsSync(
    templateOrExpr: string | Expression,
    compileTimeBindings?: any,
  ): Function {
    return Function(
      DATA_PARAM_KEY,
      BINDINGS_PARAM_KEY,
      this.translate(templateOrExpr, compileTimeBindings),
    );
  }

  private static compileAsAsync(
    templateOrExpr: string | Expression,
    compileTimeBindings?: any,
  ): Function {
    return CommonUtils.CreateAsyncFunction(
      DATA_PARAM_KEY,
      BINDINGS_PARAM_KEY,
      this.translate(templateOrExpr, compileTimeBindings),
    );
  }

  static parse(template: string, compileTimeBindings?: any): Expression {
    const lexer = new JsonTemplateLexer(template);
    const parser = new JsonTemplateParser(lexer, compileTimeBindings);
    return parser.parse();
  }

  static translate(templateOrExpr: string | Expression, compileTimeBindings?: any): string {
    if (typeof templateOrExpr === 'string') {
      return this.translateTemplate(templateOrExpr, compileTimeBindings);
    }
    return this.translateExpression(templateOrExpr);
  }

  private static translateTemplate(template: string, compileTimeBindings?: any): string {
    return this.translateExpression(this.parse(template, compileTimeBindings));
  }

  private static translateExpression(expr: Expression): string {
    const translator = new JsonTemplateTranslator(expr);
    return translator.translate();
  }

  evaluate(data: any, bindings: any = {}): any {
    return this.fn(data || {}, bindings);
  }
}
