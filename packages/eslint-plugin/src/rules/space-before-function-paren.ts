import type { TSESTree } from '@typescript-eslint/utils';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';

import { createRule, isOpeningParenToken } from '../util';

type Option = 'always' | 'never';
type FuncOption = Option | 'ignore';

export type Options = [
  | Option
  | {
      anonymous?: FuncOption;
      named?: FuncOption;
      asyncArrow?: FuncOption;
    },
];
export type MessageIds = 'missing' | 'unexpected';

export default createRule<Options, MessageIds>({
  name: 'space-before-function-paren',
  meta: {
    deprecated: true,
    replacedBy: ['@stylistic/ts/space-before-function-paren'],
    type: 'layout',
    docs: {
      description: 'Enforce consistent spacing before function parenthesis',
      extendsBaseRule: true,
    },
    fixable: 'whitespace',
    schema: [
      {
        oneOf: [
          {
            type: 'string',
            enum: ['always', 'never'],
          },
          {
            type: 'object',
            properties: {
              anonymous: {
                type: 'string',
                enum: ['always', 'never', 'ignore'],
              },
              named: {
                type: 'string',
                enum: ['always', 'never', 'ignore'],
              },
              asyncArrow: {
                type: 'string',
                enum: ['always', 'never', 'ignore'],
              },
            },
            additionalProperties: false,
          },
        ],
      },
    ],
    messages: {
      unexpected: 'Unexpected space before function parentheses.',
      missing: 'Missing space before function parentheses.',
    },
  },
  defaultOptions: ['always'],

  create(context, [firstOption]) {
    const baseConfig = typeof firstOption === 'string' ? firstOption : 'always';
    const overrideConfig = typeof firstOption === 'object' ? firstOption : {};

    /**
     * Determines whether a function has a name.
     */
    function isNamedFunction(
      node:
        | TSESTree.ArrowFunctionExpression
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.TSDeclareFunction
        | TSESTree.TSEmptyBodyFunctionExpression,
    ): boolean {
      if (node.id != null) {
        return true;
      }

      const parent = node.parent;

      return (
        parent.type === AST_NODE_TYPES.MethodDefinition ||
        parent.type === AST_NODE_TYPES.TSAbstractMethodDefinition ||
        (parent.type === AST_NODE_TYPES.Property &&
          (parent.kind === 'get' || parent.kind === 'set' || parent.method))
      );
    }

    /**
     * Gets the config for a given function
     */
    function getConfigForFunction(
      node:
        | TSESTree.ArrowFunctionExpression
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.TSDeclareFunction
        | TSESTree.TSEmptyBodyFunctionExpression,
    ): FuncOption {
      if (node.type === AST_NODE_TYPES.ArrowFunctionExpression) {
        // Always ignore non-async functions and arrow functions without parens, e.g. async foo => bar
        if (
          node.async &&
          isOpeningParenToken(
            context.sourceCode.getFirstToken(node, { skip: 1 })!,
          )
        ) {
          return overrideConfig.asyncArrow ?? baseConfig;
        }
      } else if (isNamedFunction(node)) {
        return overrideConfig.named ?? baseConfig;

        // `generator-star-spacing` should warn anonymous generators. E.g. `function* () {}`
      } else if (!node.generator) {
        return overrideConfig.anonymous ?? baseConfig;
      }

      return 'ignore';
    }

    /**
     * Checks the parens of a function node
     * @param node A function node
     */
    function checkFunction(
      node:
        | TSESTree.ArrowFunctionExpression
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.TSDeclareFunction
        | TSESTree.TSEmptyBodyFunctionExpression,
    ): void {
      const functionConfig = getConfigForFunction(node);

      if (functionConfig === 'ignore') {
        return;
      }

      let leftToken: TSESTree.Token;
      let rightToken: TSESTree.Token;
      if (node.typeParameters) {
        leftToken = context.sourceCode.getLastToken(node.typeParameters)!;
        rightToken = context.sourceCode.getTokenAfter(leftToken)!;
      } else {
        rightToken = context.sourceCode.getFirstToken(
          node,
          isOpeningParenToken,
        )!;
        leftToken = context.sourceCode.getTokenBefore(rightToken)!;
      }

      const hasSpacing = context.sourceCode.isSpaceBetween(
        leftToken,
        rightToken,
      );

      if (hasSpacing && functionConfig === 'never') {
        context.report({
          node,
          loc: {
            start: leftToken.loc.end,
            end: rightToken.loc.start,
          },
          messageId: 'unexpected',
          fix: fixer =>
            fixer.removeRange([leftToken.range[1], rightToken.range[0]]),
        });
      } else if (
        !hasSpacing &&
        functionConfig === 'always' &&
        (!node.typeParameters || node.id)
      ) {
        context.report({
          node,
          loc: rightToken.loc,
          messageId: 'missing',
          fix: fixer => fixer.insertTextAfter(leftToken, ' '),
        });
      }
    }

    return {
      ArrowFunctionExpression: checkFunction,
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      TSEmptyBodyFunctionExpression: checkFunction,
      TSDeclareFunction: checkFunction,
    };
  },
});
