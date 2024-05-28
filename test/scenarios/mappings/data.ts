import { PathType } from '../../../src';
import type { Scenario } from '../../types';

const input = {
  discount: 10,
  events: ['purchase', 'custom'],
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
    containsMappings: true,
    templatePath: 'all_features.json',
    options: {
      defaultPathType: PathType.JSON,
    },
    input,
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
          revenue: 14.4,
        },
      ],
    },
  },
  {
    containsMappings: true,
    templatePath: 'filters.json',
    options: {
      defaultPathType: PathType.JSON,
    },
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
    containsMappings: true,
    templatePath: 'index_mappings.json',
    options: {
      defaultPathType: PathType.JSON,
    },
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
    containsMappings: true,
    templatePath: 'mappings_with_root_fields.json',
    options: {
      defaultPathType: PathType.JSON,
    },
    input,
    output: {
      items: [
        {
          product_id: 1,
          product_name: 'p1',
          product_category: 'baby',
          discount: 10,
        },
        {
          product_id: 2,
          product_name: 'p2',
          discount: 10,
        },
        {
          product_id: 3,
          product_name: 'p3',
          product_category: 'home',
          discount: 10,
        },
      ],
    },
  },

  {
    containsMappings: true,
    templatePath: 'nested_mappings.json',
    options: {
      defaultPathType: PathType.JSON,
    },
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
    containsMappings: true,
    templatePath: 'transformations.json',
    options: {
      defaultPathType: PathType.JSON,
    },
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
