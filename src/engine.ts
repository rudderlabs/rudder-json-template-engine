import { BINDINGS_PARAM_KEY, DATA_PARAM_KEY } from './constants';
import { JsonTemplateLexer } from './lexer';
import { JsonTemplateParser } from './parser';
import { JsonTemplateTranslator } from './translator';
import { EngineOptions, Expression, FlatMappingAST, FlatMappingPaths } from './types';
import { CreateAsyncFunction, convertToObjectMapping } from './utils';

export class JsonTemplateEngine {
  private readonly fn: Function;

  private constructor(fn: Function) {
    this.fn = fn;
  }

  private static compileAsSync(
    templateOrExpr: string | Expression,
    options?: EngineOptions,
  ): Function {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    return Function(DATA_PARAM_KEY, BINDINGS_PARAM_KEY, this.translate(templateOrExpr, options));
  }

  private static compileAsAsync(
    templateOrExpr: string | Expression | FlatMappingPaths[],
    options?: EngineOptions,
  ): Function {
    return CreateAsyncFunction(
      DATA_PARAM_KEY,
      BINDINGS_PARAM_KEY,
      this.translate(templateOrExpr, options),
    );
  }

  private static translateTemplate(template: string, options?: EngineOptions): string {
    return this.translateExpression(this.parse(template, options));
  }

  private static translateExpression(expr: Expression): string {
    const translator = new JsonTemplateTranslator(expr);
    return translator.translate();
  }

  static parseMappingPaths(mappings: FlatMappingPaths[]): FlatMappingAST[] {
    return mappings.map((mapping) => ({
      input: JsonTemplateEngine.parse(mapping.input).statements[0],
      output: JsonTemplateEngine.parse(mapping.output).statements[0],
    }));
  }

  static create(
    templateOrExpr: string | Expression | FlatMappingPaths[],
    options?: EngineOptions,
  ): JsonTemplateEngine {
    return new JsonTemplateEngine(this.compileAsAsync(templateOrExpr, options));
  }

  static createAsSync(
    templateOrExpr: string | Expression,
    options?: EngineOptions,
  ): JsonTemplateEngine {
    return new JsonTemplateEngine(this.compileAsSync(templateOrExpr, options));
  }

  static parse(template: string, options?: EngineOptions): Expression {
    const lexer = new JsonTemplateLexer(template);
    const parser = new JsonTemplateParser(lexer, options);
    return parser.parse();
  }

  static translate(
    template: string | Expression | FlatMappingPaths[],
    options?: EngineOptions,
  ): string {
    if (typeof template === 'string') {
      return this.translateTemplate(template, options);
    }
    let templateExpr = template as Expression;
    if (Array.isArray(template)) {
      templateExpr = convertToObjectMapping(this.parseMappingPaths(template));
    }
    return this.translateExpression(templateExpr);
  }

  evaluate(data: unknown, bindings: Record<string, unknown> = {}): unknown {
    return this.fn(data ?? {}, bindings);
  }
}
