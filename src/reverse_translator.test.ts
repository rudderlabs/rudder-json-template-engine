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

  it('should reverse translate json mappings', () => {
    const template = JsonTemplateEngine.reverseTranslate(
      JsonTemplateEngine.parse([
        {
          input: '$.userId',
          output: '$.user.id',
        },
        {
          input: '$.discount',
          output: '$.events[0].items[*].discount',
        },
        {
          input: '$.products[?(@.category)].id',
          output: '$.events[0].items[*].product_id',
        },
        {
          input: '$.events[0]',
          output: '$.events[0].name',
        },
        {
          input: '$.products[?(@.category)].variations[*].size',
          output: '$.events[0].items[*].options[*].s',
        },
        {
          input: '$.products[?(@.category)].(@.price * @.quantity * (1 - $.discount / 100))',
          output: '$.events[0].items[*].value',
        },
        {
          input: '$.products[?(@.category)].(@.price * @.quantity * (1 - $.discount / 100)).sum()',
          output: '$.events[0].revenue',
        },
      ]),
    );
    expect(template).toEqual(
      '{\n    "user": {\n        "id": $.userId\n    },\n    "events": [{\n        "items": $.products{.category}.({\n            "discount": $.discount,\n            "product_id":.id,\n            "options":.variations[*].({\n                "s":.size\n            })[],\n            "value":.price *.quantity * (1 - $.discount / 100)\n        })[],\n        "name": $.events[0],\n        "revenue": $.products{.category}.(.price *.quantity * (1 - $.discount / 100)).sum()\n    }]\n}',
    );
  });
});
