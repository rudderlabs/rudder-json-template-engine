import { BINDINGS_PARAM_KEY, DATA_PARAM_KEY } from './constants';
import { JsonTemplateLexer } from './lexer';
import { JsonTemplateParser } from './parser';
import { JsonTemplateTranslator } from './translator';
import { CommonUtils } from './utils';

export class JsonTemplateEngine {
  private readonly fn: Function;
  constructor(template: string) {
    this.fn = JsonTemplateEngine.compile(template);
  }

  private static compile(template: string): Function {
    const lexer = new JsonTemplateLexer(template);
    const parser = new JsonTemplateParser(lexer);
    const translator = new JsonTemplateTranslator(parser.parse());
    const code = translator.translate();
    return CommonUtils.CreateAsyncFunction(DATA_PARAM_KEY, BINDINGS_PARAM_KEY, code);
  }

  evaluate(data: any, bindings: any = {}): Promise<any> {
    return this.fn(data || {}, bindings);
  }
}
