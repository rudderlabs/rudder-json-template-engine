import { isStandardFunction, standardFunctions } from './operators';

describe('Operators tests', () => {
  describe('isStandardFunction', () => {
    it('should return true for standard functions', () => {
      expect(Object.keys(standardFunctions).every(isStandardFunction)).toBeTruthy();
    });
    it('should return false for non standard function', () => {
      const nonStandardFunctions = [
        'toString',
        'valueOf',
        'toLocaleString',
        'hasOwnProperty',
        'isPrototypeOf',
        'propertyIsEnumerable',
        'constructor',
      ];
      expect(Object.keys(nonStandardFunctions).every(isStandardFunction)).toBeFalsy();
    });
  });
});
