import { Scenario } from '../../types';

export const data: Scenario[] = [
  {
    templatePath: 'invalid_wild_cards.jt',
    error: 'Invalid object wildcard prop value',
  },
  {
    output: {
      a: 1,
      b: 2,
      d: 3,
    },
  },
  {
    templatePath: 'wild_cards.jt',
    input: {
      traits: {
        name: 'John Doe',
        age: 30,
      },
      events: {
        foo: 'bar',
        something: 'something else',
      },
    },
    output: {
      user: {
        props: {
          name: {
            value: 'John Doe',
          },
          age: {
            value: 30,
          },
        },
        events: {
          bar: 'foo',
          'something else': 'something',
        },
      },
    },
  },
];
