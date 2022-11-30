import { Sceanario } from '../../types';

export const data: Sceanario[] = [
  {
    compileTimeBindings: { a: 1, b: 'string', c: { c: 1.02 }, d: [null, true, false] },
    output: [1, 'string', { c: 1.02 }, [null, true, false]],
  },
];
