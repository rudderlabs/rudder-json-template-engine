/* eslint-disable no-param-reassign */
import { EMPTY_EXPR } from '../constants';
import {
  SyntaxType,
  PathExpression,
  ObjectPropExpression,
  ArrayExpression,
  ObjectExpression,
  FlatMappingAST,
  Expression,
  IndexFilterExpression,
  BlockExpression,
  TokenType,
} from '../types';
import { createBlockExpression, getLastElement } from './common';

function createObjectExpression(): ObjectExpression {
  return {
    type: SyntaxType.OBJECT_EXPR,
    props: [] as ObjectPropExpression[],
  };
}

function findOrCreateObjectPropExpression(
  props: ObjectPropExpression[],
  key: string,
): ObjectPropExpression {
  let match = props.find((prop) => prop.key === key);
  if (!match) {
    match = {
      type: SyntaxType.OBJECT_PROP_EXPR,
      key,
      value: createObjectExpression(),
    };
    props.push(match);
  }
  return match;
}

function processArrayIndexFilter(
  currrentOutputPropAST: ObjectPropExpression,
  filter: IndexFilterExpression,
): ObjectExpression {
  const filterIndex = filter.indexes.elements[0].value;
  if (currrentOutputPropAST.value.type !== SyntaxType.ARRAY_EXPR) {
    const elements: Expression[] = [];
    elements[filterIndex] = currrentOutputPropAST.value;
    currrentOutputPropAST.value = {
      type: SyntaxType.ARRAY_EXPR,
      elements,
    };
  } else if (!currrentOutputPropAST.value.elements[filterIndex]) {
    (currrentOutputPropAST.value as ArrayExpression).elements[filterIndex] =
      createObjectExpression();
  }
  return currrentOutputPropAST.value.elements[filterIndex];
}

function processAllFilter(
  currentInputAST: PathExpression,
  currentOutputPropAST: ObjectPropExpression,
): Expression {
  const filterIndex = currentInputAST.parts.findIndex(
    (part) => part.type === SyntaxType.OBJECT_FILTER_EXPR,
  );

  if (filterIndex === -1) {
    if (currentOutputPropAST.value.type === SyntaxType.OBJECT_EXPR) {
      return currentOutputPropAST.value;
    }
  } else {
    const matchedInputParts = currentInputAST.parts.splice(0, filterIndex + 1);
    if (currentOutputPropAST.value.type !== SyntaxType.PATH) {
      matchedInputParts.push(createBlockExpression(currentOutputPropAST.value));
      currentOutputPropAST.value = {
        type: SyntaxType.PATH,
        root: currentInputAST.root,
        pathType: currentInputAST.pathType,
        parts: matchedInputParts,
        returnAsArray: true,
      } as PathExpression;
    }
    currentInputAST.root = undefined;
  }

  const blockExpr = getLastElement(currentOutputPropAST.value.parts) as Expression;
  return blockExpr?.statements?.[0] || EMPTY_EXPR;
}

function isWildcardSelector(expr: Expression): boolean {
  return expr.type === SyntaxType.SELECTOR && expr.prop?.value === '*';
}

function processWildCardSelector(
  flatMapping: FlatMappingAST,
  currentOutputPropAST: ObjectPropExpression,
  isLastPart: boolean = false,
): ObjectExpression {
  const currentInputAST = flatMapping.inputExpr;
  const filterIndex = currentInputAST.parts.findIndex(isWildcardSelector);

  if (filterIndex === -1) {
    throw new Error(
      `Invalid object mapping: input=${flatMapping.input} and output=${flatMapping.output}`,
    );
  }
  const matchedInputParts = currentInputAST.parts.splice(0, filterIndex);
  currentInputAST.parts = currentInputAST.parts.slice(1);
  if (currentOutputPropAST.value.type !== SyntaxType.PATH) {
    matchedInputParts.push(createBlockExpression(currentOutputPropAST.value));
    currentOutputPropAST.value = {
      type: SyntaxType.PATH,
      root: currentInputAST.root,
      pathType: currentInputAST.pathType,
      parts: matchedInputParts,
    } as PathExpression;
  }
  currentInputAST.root = 'e.value';

  const blockExpr = getLastElement(currentOutputPropAST.value.parts) as BlockExpression;
  const blockObjectExpr = blockExpr.statements[0] as ObjectExpression;
  const objectExpr = createObjectExpression();
  blockObjectExpr.props.push({
    type: SyntaxType.OBJECT_PROP_EXPR,
    key: {
      type: SyntaxType.PATH,
      root: 'e',
      parts: [
        {
          type: SyntaxType.SELECTOR,
          selector: '.',
          prop: {
            type: TokenType.ID,
            value: 'key',
          },
        },
      ],
    },
    value: isLastPart ? currentInputAST : objectExpr,
    contextVar: 'e',
  });
  return objectExpr;
}

function handleNextPart(
  flatMapping: FlatMappingAST,
  partNum: number,
  currentOutputPropAST: ObjectPropExpression,
): Expression | undefined {
  const nextOutputPart = flatMapping.outputExpr.parts[partNum];
  if (nextOutputPart.filter?.type === SyntaxType.ALL_FILTER_EXPR) {
    return processAllFilter(flatMapping.inputExpr, currentOutputPropAST);
  }
  if (nextOutputPart.filter?.type === SyntaxType.ARRAY_INDEX_FILTER_EXPR) {
    return processArrayIndexFilter(
      currentOutputPropAST,
      nextOutputPart.filter as IndexFilterExpression,
    );
  }
  if (isWildcardSelector(nextOutputPart)) {
    return processWildCardSelector(
      flatMapping,
      currentOutputPropAST,
      partNum === flatMapping.outputExpr.parts.length - 1,
    );
  }
}

function handleNextParts(
  flatMapping: FlatMappingAST,
  partNum: number,
  currentOutputPropAST: ObjectPropExpression,
): Expression {
  let objectExpr = currentOutputPropAST.value;
  let newPartNum = partNum;
  while (newPartNum < flatMapping.outputExpr.parts.length) {
    const nextObjectExpr = handleNextPart(flatMapping, newPartNum, currentOutputPropAST);
    if (!nextObjectExpr) {
      break;
    }
    newPartNum++;
    objectExpr = nextObjectExpr;
  }
  return objectExpr;
}

function processFlatMappingPart(
  flatMapping: FlatMappingAST,
  partNum: number,
  currentOutputPropsAST: ObjectPropExpression[],
): ObjectPropExpression[] {
  const outputPart = flatMapping.outputExpr.parts[partNum];
  if (
    outputPart.type !== SyntaxType.SELECTOR ||
    !outputPart.prop?.value ||
    outputPart.prop.value === '*'
  ) {
    return currentOutputPropsAST;
  }
  const key = outputPart.prop.value;

  if (partNum === flatMapping.outputExpr.parts.length - 1) {
    currentOutputPropsAST.push({
      type: SyntaxType.OBJECT_PROP_EXPR,
      key,
      value: flatMapping.inputExpr,
    } as ObjectPropExpression);
    return currentOutputPropsAST;
  }

  const currentOutputPropAST = findOrCreateObjectPropExpression(currentOutputPropsAST, key);

  const objectExpr = handleNextParts(flatMapping, partNum + 1, currentOutputPropAST);
  if (
    objectExpr.type !== SyntaxType.OBJECT_EXPR ||
    !objectExpr.props ||
    !Array.isArray(objectExpr.props)
  ) {
    throw new Error(`Failed to process output mapping: ${flatMapping.output}`);
  }
  return objectExpr.props;
}

function handleRootOnlyOutputMapping(flatMapping: FlatMappingAST, outputAST: ObjectExpression) {
  outputAST.props.push({
    type: SyntaxType.OBJECT_PROP_EXPR,
    value: {
      type: SyntaxType.SPREAD_EXPR,
      value: flatMapping.inputExpr,
    },
  } as ObjectPropExpression);
}

function validateMapping(flatMapping: FlatMappingAST) {
  if (flatMapping.outputExpr.type !== SyntaxType.PATH) {
    throw new Error(
      `Invalid object mapping: output=${flatMapping.output} should be a path expression`,
    );
  }
}
/**
 * Convert Flat to Object Mappings
 */
export function convertToObjectMapping(
  flatMappingASTs: FlatMappingAST[],
): ObjectExpression | PathExpression {
  const outputAST: ObjectExpression = createObjectExpression();
  for (const flatMapping of flatMappingASTs) {
    validateMapping(flatMapping);
    if (flatMapping.outputExpr.parts.length > 0) {
      let currentOutputPropsAST = outputAST.props;
      for (let i = 0; i < flatMapping.outputExpr.parts.length; i++) {
        currentOutputPropsAST = processFlatMappingPart(flatMapping, i, currentOutputPropsAST);
      }
    } else {
      handleRootOnlyOutputMapping(flatMapping, outputAST);
    }
  }

  return outputAST;
}
