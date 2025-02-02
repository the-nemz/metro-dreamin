import globals from "globals";
import pluginReact from "eslint-plugin-react";
import pluginTypeScript from "@typescript-eslint/eslint-plugin";
import parserTypeScript from "@typescript-eslint/parser";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: ["**/*.{js,ts,mjs,cjs,jsx,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parser: parserTypeScript,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      '@typescript-eslint': pluginTypeScript,
    },
    rules: {
      ...pluginTypeScript.configs.recommended.rules,
      ...pluginReact.configs.flat.recommended.rules,
    },
    settings: {
      'import/resolver': {
        node: {
          paths: ['.'],
          extensions: ['.js', '.jsx', '.ts', '.tsx']
        },
        alias: {
          map: [
            ['/components', './components'],
            ['/pages', './pages'],
            ['/types', './types'],
            ['/util', './util']
          ],
          extensions: ['.js', '.jsx', '.ts', '.tsx']
        }
      }
    }
  },
];
