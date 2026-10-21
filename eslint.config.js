import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const layerMessage = "Crosses a layer boundary. See the layer table in docs/ARCHITECTURE.md.";
const app = "**/app/**";
const view = "**/view/**";
const levels = "**/levels/**";
const main = "**/main.ts";
const bench = "**/bench/**";
const scripts = "**/scripts/**";

export default tseslint.config(
  { ignores: ["dist"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        {
          allowTypedFunctionExpressions: false,
          allowHigherOrderFunctions: false,
          allowDirectConstAssertionInArrowFunctions: false,
        },
      ],
      "@typescript-eslint/typedef": [
        "error",
        {
          arrayDestructuring: true,
          objectDestructuring: true,
          parameter: true,
          arrowParameter: true,
          variableDeclaration: true,
          variableDeclarationIgnoreFunction: true,
          propertyDeclaration: true,
          memberVariableDeclaration: true,
        },
      ],
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "default", format: ["camelCase"] },
        // noUnusedParameters only accepts an unused parameter whose name starts with "_".
        {
          selector: "parameter",
          modifiers: ["unused"],
          format: ["camelCase"],
          leadingUnderscore: "allow",
        },
        { selector: "typeLike", format: ["PascalCase"] },
        {
          selector: "variable",
          modifiers: ["const", "global"],
          format: ["camelCase", "UPPER_CASE"],
        },
        { selector: "import", format: ["camelCase", "PascalCase"] },
        // Keys like "@typescript-eslint/typedef" can't follow any case.
        { selector: "objectLiteralProperty", modifiers: ["requiresQuotes"], format: null },
      ],
    },
  },
  { files: ["scripts/**/*.ts"], languageOptions: { globals: { ...globals.node } } },
  {
    files: ["src/core/**/*.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        { patterns: [{ group: [app, view, levels, main, bench, scripts], message: layerMessage }] },
      ],
    },
  },
  {
    files: ["scripts/**/*.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: [app, view, levels, main], message: layerMessage },
            { group: [bench], allowTypeImports: true, message: layerMessage },
          ],
        },
      ],
    },
  },
  {
    files: ["bench/**/*.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        { patterns: [{ group: [levels, main, scripts], message: layerMessage }] },
      ],
    },
  },
  {
    files: ["src/app/**/*.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        { patterns: [{ group: [view, levels, main, bench, scripts], message: layerMessage }] },
      ],
    },
  },
  {
    files: ["src/view/**/*.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: [levels, main, bench, scripts], message: layerMessage },
            { group: ["**/core/**"], allowTypeImports: true, message: layerMessage },
          ],
        },
      ],
    },
  },
  // Plain JS files aren't in the TS project, so type-aware rules can't run on them, and they can't carry annotations.
  { files: ["**/*.js"], ...tseslint.configs.disableTypeChecked },
  {
    files: ["**/*.js"],
    rules: {
      "@typescript-eslint/typedef": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
    },
  },
);
