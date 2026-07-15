import globals from "globals";
import pluginJs from "@eslint/js";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginUnusedImports from "eslint-plugin-unused-imports";

export default [
  {
    files: [
      "src/components/**/*.{js,mjs,cjs,jsx}",
      "src/pages/**/*.{js,mjs,cjs,jsx}",
      "src/Layout.jsx",
    ],
    ignores: ["src/lib/**/*", "src/components/ui/**/*"],
    languageOptions: {
      globals: {
        ...globals.browser,
        // Globais injetadas pelo Vite (define em vite.config.js).
        __APP_VERSION__: "readonly",
        __BUILD_TIME__: "readonly",
      },
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    plugins: {
      react: pluginReact,
      "react-hooks": pluginReactHooks,
      "unused-imports": pluginUnusedImports,
    },
    rules: {
      // Rulesets recomendados PRIMEIRO (mesclados), senao o bloco `rules`
      // abaixo os sobrescreveria por completo — foi essa sobrescrita que
      // desativava `no-undef` e deixou passar o crash de import faltando
      // (ReferenceError: AREA_SUBITEMS is not defined).
      ...pluginJs.configs.recommended.rules,
      ...pluginReact.configs.flat.recommended.rules,
      // Guarda-chave: identificador usado sem import/declaracao = erro.
      "no-undef": "error",
      // A checagem de variaveis nao usadas fica com o plugin unused-imports.
      "no-unused-vars": "off",
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "error",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      // Estetico (aspas/apostrofos em texto JSX) — ruido em UI PT-BR, nao e bug.
      "react/no-unescaped-entities": "off",
      "react/no-unknown-property": [
        "error",
        { ignore: ["cmdk-input-wrapper", "toast-close"] },
      ],
      "react-hooks/rules-of-hooks": "error",
    },
  },
];
