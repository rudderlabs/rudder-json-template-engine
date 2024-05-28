/* eslint-disable no-param-reassign */
import {
  SyntaxType,
  PathExpression,
  ArrayFilterExpression,
  ObjectPropExpression,
  ArrayExpression,
  ObjectExpression,
  FlatMappingAST,
  Expression,
  IndexFilterExpression,
  AllFilterExpression,
} from '../types';
import { getLastElement } from './common';

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
    matchedInputParts.push(currentOutputPropAST.value);
    currentOutputPropAST.value = {
      type: SyntaxType.PATH,
      root: currentInputAST.root,
      pathType: currentInputAST.pathType,
      parts: matchedInputParts,
      returnAsArray: true,
    } as PathExpression;
  }
  currentInputAST.root = undefined;

  return getLastElement(currentOutputPropAST.value.parts) as ObjectExpression;
}

function processFlatMapping(flatMapping: FlatMappingAST, outputAST: ObjectExpression) {
  let currentOutputPropsAST = outputAST.props;
  const currentInputAST = flatMapping.input;

  const numOutputParts = flatMapping.output.parts.length;
  for (let i = 0; i < numOutputParts; i++) {
    const outputPart = flatMapping.output.parts[i];

    if (outputPart.type === SyntaxType.SELECTOR && outputPart.prop?.value) {
      const key = outputPart.prop.value;

      if (i === numOutputParts - 1) {
        currentOutputPropsAST.push({
          type: SyntaxType.OBJECT_PROP_EXPR,
          key,
          value: currentInputAST,
        } as ObjectPropExpression);
        break;
      }

      const currentOutputPropAST = findOrCreateObjectPropExpression(currentOutputPropsAST, key);
      let objectExpr: ObjectExpression = currentOutputPropAST.value as ObjectExpression;
      const nextOutputPart = flatMapping.output.parts[i + 1] as ArrayFilterExpression;
      if (nextOutputPart.filter?.type === SyntaxType.ALL_FILTER_EXPR) {
        objectExpr = processAllFilter(currentInputAST, currentOutputPropAST);
      } else if (nextOutputPart.filter?.type === SyntaxType.ARRAY_INDEX_FILTER_EXPR) {
        objectExpr = processArrayIndexFilter(
          currentOutputPropAST,
          nextOutputPart.filter as IndexFilterExpression,
        );
      }
      currentOutputPropsAST = objectExpr.props;
    }
  }
}
/**
 * Convert Flat to Object Mappings
 */
export function convertToObjectMapping(flatMappingAST: FlatMappingAST[]): ObjectExpression {
  const outputAST: ObjectExpression = CreateObjectExpression();

  for (const flatMapping of flatMappingAST) {
    processFlatMapping(flatMapping, outputAST);
  }

  return outputAST;
}
