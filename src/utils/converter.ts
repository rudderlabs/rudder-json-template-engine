/* eslint-disable no-param-reassign */
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
} from '../types';
import { createBlockExpression, getLastElement } from './common';

function CreateObjectExpression(): ObjectExpression {
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
      value: CreateObjectExpression(),
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
      CreateObjectExpression();
  }
  return currrentOutputPropAST.value.elements[filterIndex];
}

function processAllFilter(
  currentInputAST: PathExpression,
  currentOutputPropAST: ObjectPropExpression,
): ObjectExpression {
  const filterIndex = currentInputAST.parts.findIndex(
    (part) => part.type === SyntaxType.OBJECT_FILTER_EXPR,
  );

  if (filterIndex === -1) {
    return currentOutputPropAST.value as ObjectExpression;
  }
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

  const blockExpr = getLastElement(currentOutputPropAST.value.parts) as BlockExpression;
  return blockExpr.statements[0] as ObjectExpression;
}

function handleNextPart(
  nextOutputPart: Expression,
  currentInputAST: PathExpression,
  currentOutputPropAST: ObjectPropExpression,
): ObjectExpression {
  if (nextOutputPart.filter?.type === SyntaxType.ALL_FILTER_EXPR) {
    return processAllFilter(currentInputAST, currentOutputPropAST);
  }
  if (nextOutputPart.filter?.type === SyntaxType.ARRAY_INDEX_FILTER_EXPR) {
    return processArrayIndexFilter(
      currentOutputPropAST,
      nextOutputPart.filter as IndexFilterExpression,
    );
  }
  return currentOutputPropAST.value as ObjectExpression;
}

function processFlatMappingPart(
  flatMapping: FlatMappingAST,
  partNum: number,
  currentOutputPropsAST: ObjectPropExpression[],
): ObjectPropExpression[] {
  const outputPart = flatMapping.outputExpr.parts[partNum];

  if (outputPart.type !== SyntaxType.SELECTOR || !outputPart.prop?.value) {
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
  const nextOutputPart = flatMapping.outputExpr.parts[partNum + 1];
  const objectExpr = handleNextPart(nextOutputPart, flatMapping.inputExpr, currentOutputPropAST);
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
  const outputAST: ObjectExpression = CreateObjectExpression();

  for (const flatMapping of flatMappingAST) {
    let currentOutputPropsAST = outputAST.props;
    for (let i = 0; i < flatMapping.outputExpr.parts.length; i++) {
      currentOutputPropsAST = processFlatMappingPart(flatMapping, i, currentOutputPropsAST);
    }
  }

  return outputAST;
}
