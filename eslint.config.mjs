import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

const recommendedConfig = Array.isArray(firebaseRulesPlugin.configs['flat/recommended'])
  ? firebaseRulesPlugin.configs['flat/recommended']
  : [firebaseRulesPlugin.configs['flat/recommended']];

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  ...recommendedConfig.map((cfg) => ({
    ...cfg,
    files: ['firestore.rules'],
  })),
];
