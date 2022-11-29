import { BINDINGS_PARAM_KEY, DATA_PARAM_KEY } from './constants';
import { JsonTemplateLexer } from './lexer';
import { JsonTemplateParser } from './parser';
import { JsonTemplateTranslator } from './translator';
import { Expression } from './types';
import { CommonUtils } from './utils';

export class JsonTemplateEngine {
  private readonly fn: Function;
  constructor(template: string) {
    this.fn = JsonTemplateEngine.compile(template);
  }

  private static compile(template: string): Function {
    return CommonUtils.CreateAsyncFunction(
      DATA_PARAM_KEY,
      BINDINGS_PARAM_KEY,
      this.translate(template),
    );
  }

  static parse(template: string): Expression {
    const lexer = new JsonTemplateLexer(template);
    const parser = new JsonTemplateParser(lexer);
    return parser.parse();
  }

  static translate(template: string): string {
    const translator = new JsonTemplateTranslator(this.parse(template));
    return translator.translate();
  }

  evaluate(data: any, bindings: any = {}): Promise<any> {
    return this.fn(data || {}, bindings);
  }
}
