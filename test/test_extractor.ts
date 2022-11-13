import {
  JsonTemplateParser,
  JsonTemplateTranslator,
  JsonTemplateEngine,
  JsonTemplateLexer,
} from '../src/';

const extractor = new JsonTemplateEngine(`^{.city === "WILDWOOD A"}._id`);

const data = [
  {
    city: 'WILDWOOD A',
    loc: [-85.430456, 34.977911],
    pop: 586,
    state: 'GA',
    _id: '30757',
  },
  {
    city: 'WILDWOOD',
    loc: [-82.03473, 28.845353],
    pop: 10604,
    state: 'FL',
    _id: '34785',
  },
  {
    city: 'WILDWOOD',
    loc: [-122.918013, 40.316528],
    pop: 119,
    state: 'CA',
    _id: '96076',
  },
];
const account = {
  Account: {
    'Account Name': 'Firefly',
    Order: [
      {
        OrderID: 'order103',
        Product: [
          {
            'Product Name': 'Bowler Hat',
            ProductID: 858383,
            SKU: '0406654608',
            Description: {
              Colour: 'Purple',
              Width: 300,
              Height: 200,
              Depth: 210,
              Weight: 0.75,
            },
            Price: 34.45,
            Quantity: 2,
          },
          {
            'Product Name': 'Trilby hat',
            ProductID: 858236,
            SKU: '0406634348',
            Description: {
              Colour: 'Orange',
              Width: 300,
              Height: 200,
              Depth: 210,
              Weight: 0.6,
            },
            Price: 21.67,
            Quantity: 1,
          },
        ],
      },
      {
        OrderID: 'order104',
        Product: [
          {
            'Product Name': 'Bowler Hat',
            ProductID: 858383,
            SKU: '040657863',
            Description: {
              Colour: 'Purple',
              Width: 300,
              Height: 200,
              Depth: 210,
              Weight: 0.75,
            },
            Price: 34.45,
            Quantity: 4,
          },
          {
            ProductID: 345664,
            SKU: '0406654603',
            'Product Name': 'Cloak',
            Description: {
              Colour: 'Black',
              Width: 30,
              Height: 20,
              Depth: 210,
              Weight: 2,
            },
            Price: 107.99,
            Quantity: 1,
          },
        ],
      },
    ],
  },
};
console.log(JSON.stringify(extractor.evaluate(data, { min: 1000 }), null, 2));

console.log(
  JSON.stringify(
    new JsonTemplateEngine(`
    let a = [1, 2, 3].map(lambda ?0 + 20);
    a
    `).evaluate(account.Account.Order[0].Product[0]),
  ),
);

// console.log(JSON.stringify(new JsonTemplateParser(new JsonTemplateLexer('.a.(.b+.c)')).parse()));
console.log(
  new JsonTemplateTranslator(
    new JsonTemplateParser(
      new JsonTemplateLexer(`
      lambda ?0 + 10
      `),
    ).parse(),
  ).translate(),
);
