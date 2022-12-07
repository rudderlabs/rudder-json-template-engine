import { PathType } from '../../../src';
import { Scenario } from '../../types';

export const data: Scenario[] = [
  {
    templatePath: 'block.jt',
    input: {
      a: 1,
      b: 1,
    },
    output: [{ a: 2, b: 3 }, [2, 3]],
  },
  {
    templatePath: 'options.jt',
    options: {
      defaultPathType: PathType.RICH,
    },
    input: {
      a: {
        b: [{ c: [{ d: 1 }, { d: 2 }] }],
      },
    },
    output: [
      [
        {
          d: 1,
        },
        {
          d: 2,
        },
      ],
      [
        {
          d: 1,
        },
        {
          d: 2,
        },
      ],
      undefined,
      {
        d: 2,
      },
    ],
  },
  {
    templatePath: 'options.jt',
    options: {
      defaultPathType: PathType.SIMPLE,
    },
    input: {
      a: {
        b: [{ c: [{ d: 1 }, { d: 2 }] }],
      },
    },
    output: [
      undefined,
      [
        {
          d: 1,
        },
        {
          d: 2,
        },
      ],
      undefined,
      {
        d: 2,
      },
    ],
  },
  {
    templatePath: 'options.jt',
    options: {
      defaultPathType: PathType.SIMPLE,
    },
    input: {
      a: {
        b: {
          c: [{ d: 1 }, { d: 2 }],
        },
      },
    },
    output: [
      [
        {
          d: 1,
        },
        {
          d: 2,
        },
      ],
      [
        {
          d: 1,
        },
        {
          d: 2,
        },
      ],
      [
        {
          d: 1,
        },
        {
          d: 2,
        },
      ],
      {
        d: 2,
      },
    ],
  },
  {
    templatePath: 'rich_path.jt',
    input: [
      {
        a: { e: 1 },
        b: [{ e: 2 }, { e: [3, 2] }],
        c: { c: { e: 4 } },
        d: [
          [1, 2],
          [3, 4],
        ],
      },
    ],
    output: [1, [4], 2],
  },
  {
    templatePath: 'simple_path.jt',
    input: [
      {
        a: { e: 1 },
        b: [{ e: 2 }, { e: [3, 2] }],
        c: { c: { e: 4 } },
        d: [
          [1, 2],
          [3, 4],
        ],
      },
    ],
    output: [1, [4], 2, 1],
  },
  {
    input: [
      {
        a: { e: 1 },
        b: [{ e: 2 }, { e: [3, 2] }],
        c: { c: { e: 4 } },
        d: [
          [1, 2],
          [3, 4],
        ],
      },
    ],
    output: [
      [3],
      'aa',
      {
        e: 1,
      },
      4,
      3,
      4,
      1,
    ],
  },
];
