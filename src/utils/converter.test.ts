/* eslint-disable sonarjs/no-duplicate-string */
import { DATA_PARAM_KEY } from '../constants';
import { PathType, SyntaxType, TokenType } from '../types';
import { convertToObjectMapping } from './converter';
import { JsonTemplateEngine } from '../engine';

describe('Converter Utils Tests', () => {
  describe('convertToObjectMapping', () => {
    it('should convert single simple flat mapping to object mapping', () => {
      const objectMapping = convertToObjectMapping(
        JsonTemplateEngine.parseMappingPaths([
          {
            input: '.a.b',
            output: '.foo.bar',
          },
        ]),
      );
      expect(objectMapping).toMatchObject({
        type: SyntaxType.OBJECT_EXPR,
        props: [
          {
            type: SyntaxType.OBJECT_PROP_EXPR,
            key: 'foo',
            value: {
              type: SyntaxType.OBJECT_EXPR,
              props: [
                {
                  type: SyntaxType.OBJECT_PROP_EXPR,
                  key: 'bar',
                  value: {
                    type: SyntaxType.PATH,
                    parts: [
                      {
                        type: SyntaxType.SELECTOR,
                        selector: '.',
                        prop: { type: TokenType.ID, value: 'a' },
                      },
                      {
                        type: SyntaxType.SELECTOR,
                        selector: '.',
                        prop: { type: TokenType.ID, value: 'b' },
                      },
                    ],
                    pathType: PathType.RICH,
                  },
                },
              ],
            },
          },
        ],
      });
    });
    it('should convert single simple flat mapping with array index to object mapping', () => {
      const objectMapping = convertToObjectMapping(
        JsonTemplateEngine.parseMappingPaths([
          {
            input: '.a.b',
            output: '.foo[0].bar',
          },
        ]),
      );
      expect(objectMapping).toMatchObject({
        type: SyntaxType.OBJECT_EXPR,
        props: [
          {
            type: SyntaxType.OBJECT_PROP_EXPR,
            key: 'foo',
            value: {
              type: SyntaxType.ARRAY_EXPR,
              elements: [
                {
                  type: SyntaxType.OBJECT_EXPR,
                  props: [
                    {
                      type: SyntaxType.OBJECT_PROP_EXPR,
                      key: 'bar',
                      value: {
                        type: SyntaxType.PATH,
                        parts: [
                          {
                            type: SyntaxType.SELECTOR,
                            selector: '.',
                            prop: { type: TokenType.ID, value: 'a' },
                          },
                          {
                            type: SyntaxType.SELECTOR,
                            selector: '.',
                            prop: { type: TokenType.ID, value: 'b' },
                          },
                        ],
                        pathType: PathType.RICH,
                      },
                    },
                  ],
                },
              ],
            },
          },
        ],
      });
    });
    it('should convert single flat array mapping to object mapping', () => {
      const objectMapping = convertToObjectMapping(
        JsonTemplateEngine.parseMappingPaths([
          {
            input: '.a[*].b',
            output: '.foo[*].bar',
          },
        ]),
      );
      expect(objectMapping).toMatchObject({
        type: SyntaxType.OBJECT_EXPR,
        props: [
          {
            type: SyntaxType.OBJECT_PROP_EXPR,
            key: 'foo',
            value: {
              type: SyntaxType.PATH,
              parts: [
                {
                  type: SyntaxType.SELECTOR,
                  selector: '.',
                  prop: { type: TokenType.ID, value: 'a' },
                },
                {
                  type: SyntaxType.OBJECT_FILTER_EXPR,
                  filter: { type: SyntaxType.ALL_FILTER_EXPR },
                },
                {
                  type: SyntaxType.OBJECT_EXPR,
                  props: [
                    {
                      type: SyntaxType.OBJECT_PROP_EXPR,
                      key: 'bar',
                      value: {
                        type: SyntaxType.PATH,
                        pathType: PathType.RICH,
                        parts: [
                          {
                            type: SyntaxType.SELECTOR,
                            selector: '.',
                            prop: { type: TokenType.ID, value: 'b' },
                          },
                        ],
                      },
                    },
                  ],
                },
              ],
              pathType: PathType.RICH,
              returnAsArray: true,
            },
          },
        ],
      });
    });
    it('should convert multiple flat array mapping to object mapping', () => {
      const objectMapping = convertToObjectMapping(
        JsonTemplateEngine.parseMappingPaths([
          {
            input: '.a[*].b',
            output: '.foo[*].bar',
          },
          {
            input: '.a[*].c',
            output: '.foo[*].car',
          },
        ]),
      );
      expect(objectMapping).toMatchObject({
        type: SyntaxType.OBJECT_EXPR,
        props: [
          {
            type: SyntaxType.OBJECT_PROP_EXPR,
            key: 'foo',
            value: {
              type: SyntaxType.PATH,
              parts: [
                {
                  type: SyntaxType.SELECTOR,
                  selector: '.',
                  prop: { type: TokenType.ID, value: 'a' },
                },
                {
                  type: SyntaxType.OBJECT_FILTER_EXPR,
                  filter: { type: SyntaxType.ALL_FILTER_EXPR },
                },
                {
                  type: SyntaxType.OBJECT_EXPR,
                  props: [
                    {
                      type: SyntaxType.OBJECT_PROP_EXPR,
                      key: 'bar',
                      value: {
                        type: SyntaxType.PATH,
                        pathType: PathType.RICH,
                        parts: [
                          {
                            type: SyntaxType.SELECTOR,
                            selector: '.',
                            prop: { type: TokenType.ID, value: 'b' },
                          },
                        ],
                      },
                    },
                    {
                      type: SyntaxType.OBJECT_PROP_EXPR,
                      key: 'car',
                      value: {
                        type: SyntaxType.PATH,
                        pathType: PathType.RICH,
                        parts: [
                          {
                            type: SyntaxType.SELECTOR,
                            selector: '.',
                            prop: { type: TokenType.ID, value: 'c' },
                          },
                        ],
                      },
                    },
                  ],
                },
              ],
              pathType: PathType.RICH,
              returnAsArray: true,
            },
          },
        ],
      });
    });
    it('should convert multiple flat array mapping to object mapping with root level mapping', () => {
      const objectMapping = convertToObjectMapping(
        JsonTemplateEngine.parseMappingPaths([
          {
            input: '~j $.root',
            output: '.foo[*].boot',
          },
          {
            input: '.a[*].b',
            output: '.foo[*].bar',
          },
          {
            input: '.a[*].c',
            output: '.foo[*].car',
          },
        ]),
      );
      expect(objectMapping).toMatchObject({
        type: SyntaxType.OBJECT_EXPR,
        props: [
          {
            type: SyntaxType.OBJECT_PROP_EXPR,
            key: 'foo',
            value: {
              type: SyntaxType.PATH,
              parts: [
                {
                  type: SyntaxType.SELECTOR,
                  selector: '.',
                  prop: { type: TokenType.ID, value: 'a' },
                },
                {
                  type: SyntaxType.OBJECT_FILTER_EXPR,
                  filter: { type: SyntaxType.ALL_FILTER_EXPR },
                },
                {
                  type: SyntaxType.OBJECT_EXPR,
                  props: [
                    {
                      type: SyntaxType.OBJECT_PROP_EXPR,
                      key: 'boot',
                      value: {
                        type: SyntaxType.PATH,
                        root: DATA_PARAM_KEY,
                        parts: [
                          {
                            type: SyntaxType.SELECTOR,
                            selector: '.',
                            prop: {
                              type: TokenType.ID,
                              value: 'root',
                            },
                          },
                        ],
                        pathType: PathType.JSON,
                      },
                    },
                    {
                      type: SyntaxType.OBJECT_PROP_EXPR,
                      key: 'bar',
                      value: {
                        type: SyntaxType.PATH,
                        pathType: PathType.RICH,
                        parts: [
                          {
                            type: SyntaxType.SELECTOR,
                            selector: '.',
                            prop: { type: TokenType.ID, value: 'b' },
                          },
                        ],
                      },
                    },
                    {
                      type: SyntaxType.OBJECT_PROP_EXPR,
                      key: 'car',
                      value: {
                        type: SyntaxType.PATH,
                        pathType: PathType.RICH,
                        parts: [
                          {
                            type: SyntaxType.SELECTOR,
                            selector: '.',
                            prop: { type: TokenType.ID, value: 'c' },
                          },
                        ],
                      },
                    },
                  ],
                },
              ],
              pathType: PathType.RICH,
              returnAsArray: true,
            },
          },
        ],
      });
    });
    it('should convert multiple flat nested array mapping to object mapping with root level mapping', () => {
      const objectMapping = convertToObjectMapping(
        JsonTemplateEngine.parseMappingPaths([
          {
            input: '~j $.root',
            output: '.foo[*].boot',
          },
          {
            input: '.a[*].b',
            output: '.foo[*].bar',
          },
          {
            input: '.a[*].c',
            output: '.foo[*].car',
          },
          {
            input: '.a[*].d[*].b',
            output: '.foo[*].dog[*].bar',
          },
          {
            input: '.a[*].d[*].c',
            output: '.foo[*].dog[*].car',
          },
        ]),
      );
      expect(objectMapping).toMatchObject({
        type: SyntaxType.OBJECT_EXPR,
        props: [
          {
            type: SyntaxType.OBJECT_PROP_EXPR,
            key: 'foo',
            value: {
              type: SyntaxType.PATH,
              parts: [
                {
                  type: SyntaxType.SELECTOR,
                  selector: '.',
                  prop: {
                    type: TokenType.ID,
                    value: 'a',
                  },
                },
                {
                  type: SyntaxType.OBJECT_FILTER_EXPR,
                  filter: {
                    type: SyntaxType.ALL_FILTER_EXPR,
                  },
                },
                {
                  type: SyntaxType.OBJECT_EXPR,
                  props: [
                    {
                      type: SyntaxType.OBJECT_PROP_EXPR,
                      key: 'boot',
                      value: {
                        type: SyntaxType.PATH,
                        root: DATA_PARAM_KEY,
                        parts: [
                          {
                            type: SyntaxType.SELECTOR,
                            selector: '.',
                            prop: {
                              type: TokenType.ID,
                              value: 'root',
                            },
                          },
                        ],
                        pathType: PathType.JSON,
                      },
                    },
                    {
                      type: SyntaxType.OBJECT_PROP_EXPR,
                      key: 'bar',
                      value: {
                        type: SyntaxType.PATH,
                        pathType: PathType.RICH,
                        parts: [
                          {
                            type: SyntaxType.SELECTOR,
                            selector: '.',
                            prop: {
                              type: TokenType.ID,
                              value: 'b',
                            },
                          },
                        ],
                      },
                    },
                    {
                      type: SyntaxType.OBJECT_PROP_EXPR,
                      key: 'car',
                      value: {
                        type: SyntaxType.PATH,
                        pathType: PathType.RICH,
                        parts: [
                          {
                            type: SyntaxType.SELECTOR,
                            selector: '.',
                            prop: {
                              type: TokenType.ID,
                              value: 'c',
                            },
                          },
                        ],
                      },
                    },
                    {
                      type: SyntaxType.OBJECT_PROP_EXPR,
                      key: 'dog',
                      value: {
                        type: SyntaxType.PATH,
                        pathType: PathType.RICH,
                        parts: [
                          {
                            type: SyntaxType.SELECTOR,
                            selector: '.',
                            prop: {
                              type: TokenType.ID,
                              value: 'd',
                            },
                          },
                          {
                            type: SyntaxType.OBJECT_FILTER_EXPR,
                            filter: {
                              type: SyntaxType.ALL_FILTER_EXPR,
                            },
                          },
                          {
                            type: SyntaxType.OBJECT_EXPR,
                            props: [
                              {
                                type: SyntaxType.OBJECT_PROP_EXPR,
                                key: 'bar',
                                value: {
                                  type: SyntaxType.PATH,
                                  pathType: PathType.RICH,
                                  parts: [
                                    {
                                      type: SyntaxType.SELECTOR,
                                      selector: '.',
                                      prop: {
                                        type: TokenType.ID,
                                        value: 'b',
                                      },
                                    },
                                  ],
                                },
                              },
                              {
                                type: SyntaxType.OBJECT_PROP_EXPR,
                                key: 'car',
                                value: {
                                  type: SyntaxType.PATH,
                                  pathType: PathType.RICH,
                                  parts: [
                                    {
                                      type: SyntaxType.SELECTOR,
                                      selector: '.',
                                      prop: {
                                        type: TokenType.ID,
                                        value: 'c',
                                      },
                                    },
                                  ],
                                },
                              },
                            ],
                          },
                        ],
                        returnAsArray: true,
                      },
                    },
                  ],
                },
              ],
              pathType: PathType.RICH,
              returnAsArray: true,
            },
          },
        ],
      });
    });
  });
});
