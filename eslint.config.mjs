import globals from "globals";
import pluginJs from "@eslint/js";
import jsdoc from "eslint-plugin-jsdoc";

// noinspection JSUnusedGlobalSymbols
export default [
	{
		name: "source",
		files: [
			"src/**/*.js",
		],
		ignores: [
			"tests/**/*.js",
			"docs/**/*",
			"eslint.config.mjs",
			"jest.config.js",
		],
		languageOptions: {
			ecmaVersion: "latest",
			sourceType: "commonjs",
			globals: {
			},
		},
		plugins: {
			jsdoc: jsdoc,
		},
		rules: {
			...pluginJs.configs.all.rules,
			"capitalized-comments": "off",
			"sort-keys": "off",
			"one-var": "off",
			"no-empty-function": "off",
			"no-ternary": "off",
			"max-lines": "off",
			"no-plusplus": "off",
			"class-methods-use-this": "off",
			"no-inline-comments": "off",
			"max-lines-per-function": "off",
			"id-length": "off",
			"max-statements": "off",
			"no-continue": "off",
			"no-prototype-builtins": "off",
			"default-case": "off",
			"guard-for-in": "off",
			"no-magic-numbers": ["error", {
				ignore: [0, 1],
				ignoreArrayIndexes: true,
				ignoreDefaultValues: true,
				ignoreClassFieldInitialValues: true,
			}],
		},
	},
	{
		name: "tests",
		files: [
			"tests/**/*.js"
		],
		ignores: [
			"src/**/*.js",
			"docs/**/*",
			"eslint.config.mjs",
			"jest.config.js",
		],
		languageOptions: {
			ecmaVersion: "latest",
			sourceType: "script",
			globals: {
				...globals.browser,
				...globals.node,
				...globals.jest,
			},
		},
		rules: {
			...pluginJs.configs.recommended.rules,
		},
	},
];
