import {
  JsonTemplateParser,
  JsonTemplateTranslator,
  JsonTemplateEngine,
  JsonTemplateLexer,
} from '../src/';

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

const address = {
  FirstName: 'Fred',
  Surname: 'Smith',
  Age: 28,
  Address: {
    Street: 'Hursley Park',
    City: 'Winchester',
    Postcode: 'SO21 2JN',
  },
  Phone: [
    {
      type: 'home',
      number: '0203 544 1234',
    },
    {
      type: 'office',
      number: '01962 001234',
    },
    {
      type: 'office',
      number: '01962 001235',
    },
    {
      type: 'mobile',
      number: '077 7700 1234',
    },
  ],
  Email: [
    {
      type: 'office',
      address: ['fred.smith@my-work.com', 'fsmith@my-work.com'],
    },
    {
      type: 'home',
      address: ['freddy@my-social.com', 'frederic.smith@very-serious.com'],
    },
  ],
  Other: {
    'Over 18 ?': true,
    Misc: null,
    'Alternative.Address': {
      Street: 'Brick Lane',
      City: 'London',
      Postcode: 'E1 6RF',
    },
  },
};
// const extractor = new JsonTemplateEngine(`.{.city == "wildwood"}.pop`);

// console.log(JSON.stringify(extractor.evaluate(data, { min: 1000 }), null, 2));

// console.log(
//   JSON.stringify(
//     new JsonTemplateEngine(`
//     ..Product
//     `).evaluate(account),
//   ),
// );

// console.log(
//   JSON.stringify(
//     new JsonTemplateEngine(`
//     .Account.Order@o#oi.Product@p#pi.({
//       orderId: o.OrderID,
//       productId: p.ProductID,
//       oi: oi,
//       pi: pi
//     })
//     `).evaluate(account, { a: { b: { c: () => (a) => a, d: 2 } } }),
//   ),
// );

// console.log(
//   JSON.stringify(
//     new JsonTemplateEngine(`
//     let a = null;
//     let b = undefined;
//     let c = "";
//     let d = {};
//     a || b || c || d
//     `).evaluate(account, { a: { b: { c: () => (a) => a, d: 2 } } }),
//   ),
// );
// console.log(
//   JSON.stringify(
//     new JsonTemplateEngine(`
//     let c = "c key";
// let d = 3;
// {
//     // short form for "a"
//     a: 1,
//     "b": 2,
//     // [c] coverts to "c key"
//     [c]: {
//         // this coverts to d: 3
//         d: d
//     }
// }
//     `).evaluate(address),
//   ),
// );
// console.log(
//   // JSON.stringify(
//   new JsonTemplateTranslator(
//     new JsonTemplateParser(
//       new JsonTemplateLexer(`
//       .{.city==="WILDWOOD" && .state==="GA"}.pop
//       `),
//     ).parse(),
//   ).translate(),
//   // ),
// );

new JsonTemplateEngine(`
let a = [{a: [1, 2], b: "1"}, {a: [3, 4], b: 2}, {a:[5], b: 3}, {b: 4}]
a{.a.length > 1}.{typeof .b === "number"}
`)
  .evaluate({ a: 1 })
  .then((a) => console.log(JSON.stringify(a)));

console.log(
  new JsonTemplateTranslator(
    new JsonTemplateParser(
      new JsonTemplateLexer(`
        .[1][2]
        `),
    ).parse(),
  ).translate(),
);

console.log(
  JSON.stringify(
    new JsonTemplateParser(
      new JsonTemplateLexer(`
      a{.a.length > 1}.{typeof .b === "number"}
        `),
    ).parse(),
    null,
    2,
  ),
);
