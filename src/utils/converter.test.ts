import { SyntaxType } from '../types';
import { convertToObjectMapping } from './converter';

describe('Converter:', () => {
  describe('convertToObjectMapping', () => {
    it('should validate mappings', () => {
      expect(() =>
        convertToObjectMapping([
          { inputExpr: { type: SyntaxType.EMPTY }, outputExpr: { type: SyntaxType.EMPTY } },
        ] as any),
      ).toThrowError(/Invalid mapping/);
    });
  });
});
