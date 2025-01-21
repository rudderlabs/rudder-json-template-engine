import { JsonTemplateEngine } from './engine';
import { PathType } from './types';

describe('engine', () => {
  describe('isValidJSONPath', () => {
    it('should return true for valid JSON root path', () => {
      expect(JsonTemplateEngine.isValidJSONPath('$.user.name')).toBeTruthy();
    });

    it('should return true for valid JSON relative path', () => {
      expect(JsonTemplateEngine.isValidJSONPath('.user.name')).toBeTruthy();

      expect(JsonTemplateEngine.isValidJSONPath('@.user.name')).toBeTruthy();
    });

    it('should return false for invalid JSON path', () => {
      expect(JsonTemplateEngine.isValidJSONPath('userId')).toBeFalsy();
    });

    it('should return false for invalid template', () => {
      expect(JsonTemplateEngine.isValidJSONPath('a=')).toBeFalsy();
    });

    it('should return false for empty path', () => {
      expect(JsonTemplateEngine.isValidJSONPath('')).toBeFalsy();
    });
  });
  describe('validateMappings', () => {
    it('should validate mappings', () => {
      expect(() =>
        JsonTemplateEngine.validateMappings([
          {
            input: '$.userId',
            output: '$.user.id',
          },
          {
            input: '$.discount',
            output: '$.events[0].items[*].discount',
          },
        ]),
      ).not.toThrow();
    });

    it('should throw error for mappings which are not compatible with each other', () => {
      expect(() =>
        JsonTemplateEngine.validateMappings([
          {
            input: '$.a[0]',
            output: '$.b[0].name',
          },
          {
            input: '$.discount',
            output: '$.b[0].name[*].discount',
          },
        ]),
      ).toThrowError('Invalid mapping');
    });

    it('should throw error for mappings with invalid json paths', () => {
      expect(() =>
        JsonTemplateEngine.validateMappings([
          {
            input: 'events[0]',
            output: 'events[0].name',
          },
        ]),
      ).toThrowError('Invalid mapping');
    });
  });
  describe('isValidMapping', () => {
    it('should convert to JSON paths when options are used', () => {
      expect(
        JsonTemplateEngine.isValidMapping(
          {
            input: '$.a[0]',
            output: 'b[0].name',
          },
          { defaultPathType: PathType.JSON },
        ),
      ).toBeTruthy();
    });
    it('should throw error when output is not valid json path without engine options', () => {
      expect(
        JsonTemplateEngine.isValidMapping({
          input: '$.events[0]',
          output: 'events[0].name',
        }),
      ).toBeFalsy();
    });
  });
});
