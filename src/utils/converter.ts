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
  ObjectWildcardValueExpression,
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

function createWildcardObjectPropValueExpression(value: string): ObjectWildcardValueExpression {
  return {
    type: SyntaxType.OBJECT_PROP_WILD_CARD_VALUE_EXPR,
    value,
  };
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
  currentInputAST.root = createWildcardObjectPropValueExpression('value');

  const blockExpr = getLastElement(currentOutputPropAST.value.parts) as BlockExpression;
  const blockObjectExpr = blockExpr.statements[0] as ObjectExpression;
  const objectExpr = createObjectExpression();
  blockObjectExpr.props.push({
    type: SyntaxType.OBJECT_PROP_EXPR,
    key: createWildcardObjectPropValueExpression('key'),
    value: isLastPart ? currentInputAST : objectExpr,
    wildcard: true,
  });
  return objectExpr;
}

function handleNextPart(
  flatMapping: FlatMappingAST,
  partNum: number,
  currentOutputPropAST: ObjectPropExpression,
): Expression {
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
  return currentOutputPropAST.value;
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
  const objectExpr = handleNextPart(flatMapping, partNum + 1, currentOutputPropAST);
  if (
    objectExpr.type !== SyntaxType.OBJECT_EXPR ||
    !objectExpr.props ||
    !Array.isArray(objectExpr.props)
  ) {
    throw new Error(`Failed to process output mapping: ${flatMapping.output}`);
  }
  return objectExpr.props;
}

/**
 * Convert Flat to Object Mappings
 */
export function convertToObjectMapping(flatMappingAST: FlatMappingAST[]): ObjectExpression {
  const outputAST: ObjectExpression = createObjectExpression();

  for (const flatMapping of flatMappingAST) {
    let currentOutputPropsAST = outputAST.props;
    for (let i = 0; i < flatMapping.outputExpr.parts.length; i++) {
      currentOutputPropsAST = processFlatMappingPart(flatMapping, i, currentOutputPropsAST);
    }
  }

  return outputAST;
}
