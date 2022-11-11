function startsWithStrict(val1, val2) {
  return [
    'typeof ',
    val1,
    '=== "string" && typeof ',
    val2,
    '=== "string" &&',
    val1,
    '.indexOf(',
    val2,
    ') === 0',
  ].join('');
}

function startsWith(val1, val2) {
  return [
    val1,
    '!= null &&',
    val2,
    '!= null &&',
    val1,
    '.toString().toLowerCase().indexOf(',
    val2,
    '.toString().toLowerCase()) === 0',
  ].join('');
}

function endsWithStrict(val1, val2) {
  return [
    'typeof ',
    val1,
    '=== "string" && typeof ',
    val2,
    '=== "string" &&',
    val1,
    '.length >=',
    val2,
    '.length &&',
    val1,
    '.lastIndexOf(',
    val2,
    ') ===',
    val1,
    '.length -',
    val2,
    '.length',
  ].join('');
}

function endsWith(val1, val2) {
  return [
    val1,
    '!= null &&',
    val2,
    '!= null &&',
    '(',
    val1,
    '=',
    val1,
    '.toString()).length >=',
    '(',
    val2,
    '=',
    val2,
    '.toString()).length &&',
    '(',
    val1,
    '.toLowerCase()).lastIndexOf(',
    '(',
    val2,
    '.toLowerCase())) ===',
    val1,
    '.length -',
    val2,
    '.length',
  ].join('');
}

function containsStrict(val1, val2) {
  return [
    'typeof ',
    val1,
    '=== "string" && typeof ',
    val2,
    '=== "string" &&',
    val1,
    '.indexOf(',
    val2,
    ') > -1',
  ].join('');
}

function contains(val1, val2) {
  return [
    val1,
    '!= null && ',
    val2,
    '!= null &&',
    val1,
    '.toString().toLowerCase().indexOf(',
    val2,
    '.toString().toLowerCase()) > -1',
  ].join('');
}

export const binaryOperators = {
  '===': function (val1, val2) {
    return `${val1}===${val2}`;
  },

  '==': function (val1, val2) {
    return [
      'typeof ',
      val1,
      '=== "string" && typeof ',
      val2,
      '=== "string"?',
      val1,
      '.toLowerCase() ===',
      val2,
      `.toLowerCase() :${val1}`,
      '==',
      val2,
    ].join('');
  },

  '>=': function (val1, val2) {
    return `${val1}>=${val2}`;
  },

  '>': function (val1, val2) {
    return `${val1}>${val2}`;
  },

  '<=': function (val1, val2) {
    return `${val1}<=${val2}`;
  },

  '<': function (val1, val2) {
    return `${val1}<${val2}`;
  },

  '!==': function (val1, val2) {
    return `${val1}!==${val2}`;
  },

  '!=': function (val1, val2) {
    return `${val1}!=${val2}`;
  },

  '^==': startsWithStrict,

  '==^': function (val1, val2) {
    return startsWithStrict(val2, val1);
  },

  '^=': startsWith,

  '=^': function (val1, val2) {
    return startsWith(val2, val1);
  },

  '$==': endsWithStrict,

  '==$': function (val1, val2) {
    return endsWithStrict(val2, val1);
  },

  '$=': endsWith,

  '=$': function (val1, val2) {
    return endsWith(val2, val1);
  },

  '*==': containsStrict,

  '==*': function (val1, val2) {
    return containsStrict(val2, val1);
  },

  '=*': function (val1, val2) {
    return contains(val2, val1);
  },

  '*=': contains,

  '+': function (val1, val2) {
    return `${val1}+${val2}`;
  },

  '-': function (val1, val2) {
    return `${val1}-${val2}`;
  },

  '*': function (val1, val2) {
    return `${val1}*${val2}`;
  },

  '/': function (val1, val2) {
    return `${val1}/${val2}`;
  },

  '%': function (val1, val2) {
    return `${val1}%${val2}`;
  },

  '>>': function (val1, val2) {
    return `${val1}>>${val2}`;
  },

  '<<': function (val1, val2) {
    return `${val1}<<${val2}`;
  },

  '**': function (val1, val2) {
    return `${val1}**${val2}`;
  },
};
