module.exports = {
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'sec'],
    ],
    'subject-empty': [2, 'never'],
    'header-min-length': [2, 'always', 5],
  },
};
