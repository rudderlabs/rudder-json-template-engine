import { Scenario } from '../../types';

export const data: Scenario[] = [
  {
    containsMappings: true,
    input: {
      discount: 10,
      event: 'purchase',
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
    },
    output: {
      events: [
        {
          items: [
            {
              discount: 10,
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
              value: 5.4,
            },
            {
              discount: 10,
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
              value: 13.5,
            },
            {
              discount: 10,
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
              value: 9,
            },
          ],
          name: 'purchase',
          revenue: 27.9,
        },
      ],
    },
  },
];
