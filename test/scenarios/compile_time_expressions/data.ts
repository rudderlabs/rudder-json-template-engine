import { Sceanario } from '../../types';

export const data: Sceanario[] = [
  {
    templatePath: 'two_level_path_processing.jt',
    compileTimeBindings: {
      paths: ['a.non_existing', 'a.b.non_existing', 'a.c'],
    },
    input: {
      a: {
        c: 9,
      },
    },
    output: 9,
  },
  {
    compileTimeBindings: { a: 1, b: 'string', c: { c: 1.02 }, d: [null, true, false] },
    output: [1, 'string', { c: 1.02 }, [null, true, false]],
  },
];
