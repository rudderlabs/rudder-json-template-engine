import { EMPTY_EXPR } from '../constants';
import { SyntaxType } from '../types';
import * as CommonUtils from './common';

describe('Common Utils tests', () => {
  describe('toArray', () => {
    it('should return array for non array', () => {
      expect(CommonUtils.toArray(1)).toEqual([1]);
    });
    it('should return array for array', () => {
      expect(CommonUtils.toArray([1])).toEqual([1]);
    });
    it('should return array for undefined', () => {
      expect(CommonUtils.toArray(undefined)).toBeUndefined();
    });
  });
  describe('getLastElement', () => {
    it('should return last element of non empty array', () => {
      expect(CommonUtils.getLastElement([1, 2])).toEqual(2);
    });
    it('should return undefined for empty array', () => {
      expect(CommonUtils.getLastElement([])).toBeUndefined();
    });
  });
  describe('convertToStatementsExpr', () => {
    it('should return statement expression for no expressions', () => {
      expect(CommonUtils.convertToStatementsExpr()).toEqual({
        type: SyntaxType.STATEMENTS_EXPR,
        statements: [],
      });
    });
    it('should return statement expression for single expression', () => {
      expect(CommonUtils.convertToStatementsExpr(EMPTY_EXPR)).toEqual({
        type: SyntaxType.STATEMENTS_EXPR,
        statements: [EMPTY_EXPR],
      });
    });
    it('should return statement expression for multiple expression', () => {
      expect(CommonUtils.convertToStatementsExpr(EMPTY_EXPR, EMPTY_EXPR)).toEqual({
        type: SyntaxType.STATEMENTS_EXPR,
        statements: [EMPTY_EXPR, EMPTY_EXPR],
      });
    });
  });

  describe('escapeStr', () => {
    it('should return emtpy string for non string input', () => {
      expect(CommonUtils.escapeStr(undefined)).toEqual('');
    });
    it('should return escaped string for simple string input', () => {
      expect(CommonUtils.escapeStr('aabc')).toEqual(`"aabc"`);
    });

    it('should return escaped string for string with escape characters', () => {
      expect(CommonUtils.escapeStr(`a\nb'"c`)).toEqual(`"a\nb'\\"c"`);
    });
  });
  describe('CreateAsyncFunction', () => {
    it('should return async function from code without args', async () => {
      expect(await CommonUtils.CreateAsyncFunction('return 1')()).toEqual(1);
    });
    it('should return async function from code with args', async () => {
      expect(await CommonUtils.CreateAsyncFunction('input', 'return input')(1)).toEqual(1);
    });
  });
});
