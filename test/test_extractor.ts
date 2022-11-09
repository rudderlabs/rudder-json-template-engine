import {
  JsonTemplateParser,
  JsonTemplateTranslator,
  JsonTemplateEngine,
  JsonTemplateLexer,
} from '../src/';

const extractor = new JsonTemplateEngine(`.[{.city === "WILDWOOD"}{.state === "FL"}]`);

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
console.log(JSON.stringify(extractor.evaluate(data, { min: 1000 }), null, 2));

// const context = {}
// console.log(JSON.stringify(new JsonTemplateEngine(`
// .pop
// `).evaluate(data[0], {context, fn: () => 100})));
// console.log(context);

console.log(
  JSON.stringify(
    new JsonTemplateEngine(`
    let b = "b";
    // this is comment
    let a = {
      [b]: [1, 2, 3], 
      c: function(v1) {
        function() {
          [v1, 2*v1, function(){
            3 * v1
          }]
        }
      }
    };
    let i = 109;
    a.c(i)()[2]()
`).evaluate({ a: { b: 1, c: 2 } }),
  ),
);

// console.log(JSON.stringify(new JsonTemplateParser(new JsonTemplateLexer('.a.(.b+.c)')).parse()));
console.log(
  new JsonTemplateTranslator(
    new JsonTemplateParser(
      new JsonTemplateLexer(`
      let b = "b";
      let a = {
        [b]: [1, 2, 3], 
        c: function(v1) {
          v1
        }
      };
      let i = 109;
      a.c(i)
     `),
    ).parse(),
  ).translate(),
);
