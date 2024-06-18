import { JsonTemplateEngine } from './engine';

describe('reverse_translator', () => {
  it('should reverse translate with indentation', () => {
    const template = JsonTemplateEngine.reverseTranslate(
      JsonTemplateEngine.parse(`{a: {b: {c: 1}}}`),
    );
    expect(template).toEqual(
      '{\n    "a": {\n        "b": {\n            "c": 1\n        }\n    }\n}',
    );
  });
});
