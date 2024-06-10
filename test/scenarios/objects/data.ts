import { Scenario } from '../../types';

export const data: Scenario[] = [
  {
    templatePath: 'context_props.jt',
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
          someKey: {
            value: 'someValue',
          },
        },
        events: {
          bar: 'foo',
          'something else': 'something',
          someEventValue: 'someEventName',
        },
      },
    },
  },
  {
    templatePath: 'invalid_context_prop.jt',
    error: 'Context prop should be used with a key expression',
  },
  {
    output: {
      a: 1,
      b: 2,
      d: 3,
    },
  },
];
