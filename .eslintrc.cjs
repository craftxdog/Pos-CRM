module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.2' } },
  plugins: ['react-refresh'],
  rules: {
    // El proyecto usa JavaScript moderno sin PropTypes. La validación de datos
    // se realiza en formularios y contratos de API, no con tipos en runtime.
    'react/prop-types': 'off',
    // El código heredado contiene imports y parámetros sin uso. Se eliminan
    // progresivamente sin bloquear las reglas que detectan fallos de ejecución.
    'no-unused-vars': 'off',
    'react-hooks/exhaustive-deps': 'off',
    'react-refresh/only-export-components': 'off',
  },
}
