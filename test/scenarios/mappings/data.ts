import type { Scenario } from '../../types';

const input = {
  userId: 'u1',
  discount: 10,
  coupon: 'DISCOUNT',
  events: ['purchase', 'custom'],
  details: {
    name: 'Purchase',
    timestamp: 1630000000,
  },
  context: {
    traits: {
      email: 'dummy@example.com',
      first_name: 'John',
      last_name: 'Doe',
      phone: '1234567890',
    },
  },
  products: [
    {
      id: 1,
      name: 'p1',
      category: 'baby',
      price: 3,
      quantity: 2,
      variations: [
        {
          color: 'blue',
          size: 1,
        },
        {
          size: 2,
        },
      ],
    },
    {
      id: 2,
      name: 'p2',
      price: 5,
      quantity: 3,
      variations: [
        {
          length: 1,
        },
        {
          color: 'red',
          length: 2,
        },
      ],
    },
    {
      id: 3,
      name: 'p3',
      category: 'home',
      price: 10,
      quantity: 1,
      variations: [
        {
          width: 1,
          height: 2,
          length: 3,
        },
      ],
    },
  ],
};
export const data: Scenario[] = [
  {
    mappingsPath: 'all_features.json',
    input,
    output: {
      events: [
        {
          items: [
            {
              discount: 10,
              product_id: 1,
              coupon_code: 'DISCOUNT',
              product_name: 'p1',
              product_category: 'baby',
              options: [
                {
                  s: 1,
                  c: 'blue',
                },
                {
                  s: 2,
                },
              ],
              value: 5.4,
            },
            {
              discount: 10,
              product_id: 3,
              coupon_code: 'DISCOUNT',
              product_name: 'p3',
              product_category: 'home',
              options: [
                {
                  l: 3,
                  w: 1,
                  h: 2,
                },
              ],
              value: 9,
            },
          ],
          name: 'purchase',
          revenue: 14.4,
        },
      ],
      user: {
        id: 'u1',
      },
    },
  },
  {
    mappingsPath: 'context_vars_mapping.json',
    input: {
      a: [
        {
          foo: 1,
        },
        {
          foo: 2,
        },
      ],
    },
    output: {
      b: [
        { bar: 1, index: 0 },
        { bar: 2, index: 1 },
      ],
    },
  },
  {
    mappings: [
      {
        from: '$.a[*]',
        to: '$.b[*].#index',
      },
    ],
    error: 'Invalid mapping',
  },
  {
    mappings: [
      {
        from: '1',
        to: '$.b[*].#index',
      },
    ],
    error: 'Invalid mapping',
  },
  {
    mappingsPath: 'filters.json',

    input,
    output: {
      items: [
        {
          product_id: 1,
          product_name: 'p1',
          product_category: 'baby',
        },
        {
          product_id: 3,
          product_name: 'p3',
          product_category: 'home',
        },
      ],
    },
  },
  {
    mappingsPath: 'index_mappings.json',
    input,
    output: {
      events: [
        {
          name: 'purchase',
          type: 'identify',
        },
        {
          name: 'custom',
          type: 'track',
        },
      ],
    },
  },
  {
    mappingsPath: 'invalid_array_index_mappings.json',
    error: 'Invalid mapping',
  },
  {
    description: 'Index mappings in last part',
    mappings: [
      {
        from: '$.a[0]',
        to: '$.b[0]',
      },
      {
        from: '$.a[1]',
        to: '$.b[1]',
      },
    ],
    input: { a: [1, 2, 3] },
    output: { b: [1, 2] },
  },
  {
    mappingsPath: 'invalid_array_mappings.json',
    error: 'Invalid mapping',
  },
  {
    mappingsPath: 'invalid_object_mappings.json',
    error: 'Invalid mapping',
  },
  {
    mappingsPath: 'mappings_with_root_fields.json',
    input,
    output: {
      items: [
        {
          product_id: 1,
          product_name: 'p1',
          product_category: 'baby',
          discount: 10,
          coupon_code: 'DISCOUNT',
        },
        {
          product_id: 2,
          product_name: 'p2',
          discount: 10,
          coupon_code: 'DISCOUNT',
        },
        {
          product_id: 3,
          product_name: 'p3',
          product_category: 'home',
          discount: 10,
          coupon_code: 'DISCOUNT',
        },
      ],
    },
  },
  {
    mappingsPath: 'nested_mappings.json',
    input,
    output: {
      items: [
        {
          product_id: 1,
          product_name: 'p1',
          product_category: 'baby',
          options: [
            {
              s: 1,
              c: 'blue',
            },
            {
              s: 2,
            },
          ],
        },
        {
          product_id: 2,
          product_name: 'p2',
          options: [
            {
              l: 1,
            },
            {
              l: 2,
              c: 'red',
            },
          ],
        },
        {
          product_id: 3,
          product_name: 'p3',
          product_category: 'home',
          options: [
            {
              l: 3,
              w: 1,
              h: 2,
            },
          ],
        },
      ],
    },
  },
  {
    mappingsPath: 'non_path_output.json',
    output: {
      'Content-Type': 'application/json',
      'a.b.c': 3,
      bar: 1,
      c: { 'Content-Type': 'text/plain' },
      'x-bar': 2,
    },
  },
  {
    mappingsPath: 'object_mappings.json',
    input: {
      user_id: 1,
      traits1: {
        name: 'John Doe',
        age: 30,
      },
      traits2: [
        {
          name: {
            value: 'John Doe',
          },
        },
        {
          age: {
            value: 30,
          },
        },
      ],
      traits3: {
        display_name: 'Rudderstack Inc.',
        category: 'Analytics',
        custom_properties: {
          bar: 1,
        },
      },
    },
    output: {
      user_id: {
        value: 1,
      },
      traits1: {
        value: {
          name: 'John Doe',
          age: 30,
        },
      },
      traits2: {
        value: [
          {
            name: {
              value: 'John Doe',
            },
          },
          {
            age: {
              value: 30,
            },
          },
        ],
      },
      traits3: {
        value: {
          display_name: 'Rudderstack Inc.',
          category: 'Analytics',
          custom_properties: {
            bar: 1,
          },
        },
      },
      properties1: {
        name: {
          value: 'John Doe',
        },
        age: {
          value: 30,
        },
      },
      properties2: [
        {
          name: 'John Doe',
        },
        {
          age: 30,
        },
      ],
      properties3: {
        display_name: 'Rudderstack Inc.',
        category: 'Analytics',
        custom_properties: {
          bar: 1,
        },
        name: 'Rudderstack Inc.',
        custom: {
          bar: 1,
          foo: 1,
        },
      },
    },
  },
  {
    mappingsPath: 'or_mappings.json',
    input: {
      context: {
        properties: {
          name: 'John',
          age: 30,
        },
      },
    },
    output: {
      user: {
        name: 'John',
        age: 30,
      },
    },
  },
  {
    mappingsPath: 'or_mappings.json',
    input: {
      properties: {
        name: 'John Doe',
        age: 30,
      },
      context: {
        properties: {
          name: 'John',
          age: 30,
        },
      },
    },
    output: {
      user: {
        name: 'John Doe',
        age: 30,
      },
    },
  },
  {
    mappingsPath: 'or_mappings.json',
    input: {
      properties: {
        name: 'John Doe',
        age: 30,
      },
    },
    output: {
      user: {
        name: 'John Doe',
        age: 30,
      },
    },
  },
  {
    mappingsPath: 'root_array_mappings.json',
    input: [
      {
        user_id: 1,
        user_name: 'John Doe',
      },
      {
        user_id: 2,
        user_name: 'Jane Doe',
      },
    ],
    output: [
      {
        user: {
          id: 1,
          name: 'John Doe',
        },
      },
      {
        user: {
          id: 2,
          name: 'Jane Doe',
        },
      },
    ],
  },
  {
    mappingsPath: 'root_context_vars_mapping.json',
    input: [
      {
        foo: 1,
      },
      {
        foo: 2,
      },
    ],
    output: [
      {
        bar: 1,
        index: 0,
      },
      {
        bar: 2,
        index: 1,
      },
    ],
  },
  {
    mappingsPath: 'root_index_mappings.json',
    input: {
      id: 1,
      name: 'John Doe',
    },
    output: [
      {
        user_id: 1,
        user_name: 'John Doe',
      },
    ],
  },
  {
    mappingsPath: 'root_mappings.json',
    input,
    output: {
      traits: {
        email: 'dummy@example.com',
        first_name: 'John',
        last_name: 'Doe',
        phone: '1234567890',
      },
      event_names: ['purchase', 'custom'],
      name: 'Purchase',
      timestamp: 1630000000,
    },
  },
  {
    mappingsPath: 'root_nested_mappings.json',
    input: [
      {
        user_id: 1,
        user_name: 'John Doe',
      },
      {
        user_id: 2,
        user_name: 'Jane Doe',
      },
    ],
    output: [
      {
        user_id: {
          value: 1,
        },
        user_name: {
          value: 'John Doe',
        },
      },
      {
        user_id: {
          value: 2,
        },
        user_name: {
          value: 'Jane Doe',
        },
      },
    ],
  },
  {
    mappingsPath: 'root_object_mappings.json',
    input: {
      user_id: 1,
      user_name: 'John Doe',
    },
    output: {
      user_id: {
        value: 1,
      },
      user_name: {
        value: 'John Doe',
      },
    },
  },
  {
    description: 'array mappings in last part',
    mappings: [
      {
        from: '$.a[*]',
        to: '$.b[*]',
      },
    ],
    input: { a: [1, 2, 3] },
    output: { b: [1, 2, 3] },
  },
  {
    description: 'array mappings to scalar value',
    mappings: [
      {
        from: '1',
        to: '$.a[*].b',
      },
    ],
    output: { a: [{ b: 1 }] },
  },
  {
    description: 'array mappings to scalar value',
    mappings: [
      {
        from: '1',
        to: '$.a[*]',
      },
    ],
    output: { a: [1] },
  },
  {
    mappingsPath: 'simple_array_mappings.json',
    input: {
      user_id: 1,
      user_name: 'John Doe',
    },
    output: {
      users: [
        {
          id: 1,
          name: 'John Doe',
        },
      ],
    },
  },
  {
    input: {
      a: [
        {
          a: 1,
        },
        {
          a: 2,
        },
      ],
    },
    output: 3,
  },
  {
    template: '~m[1, 2]',
    error: 'Invalid mapping',
  },
  {
    template: '~m[{}]',
    error: 'Invalid mapping',
  },
  {
    template: '~m[{input: 1, output: 2}]',
    error: 'Invalid mapping',
  },
  {
    mappingsPath: 'transformations.json',
    input,
    output: {
      items: [
        {
          product_id: 1,
          product_name: 'p1',
          product_category: 'baby',
          value: 5.4,
        },
        {
          product_id: 2,
          product_name: 'p2',
          value: 13.5,
        },
        {
          product_id: 3,
          product_name: 'p3',
          product_category: 'home',
          value: 9,
        },
      ],
      revenue: 27.9,
    },
  },
];
