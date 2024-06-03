import { TokenType, Literal } from '../types';
import { escapeStr } from './common';

export function translateLiteral(type: TokenType, val: Literal): string {
  if (type === TokenType.STR) {
    return escapeStr(String(val));
  }

  return String(val);
}
