const shuffle = require('../shuffle');

test('shuffle returns permutation containing same elements', () => {
  const input = [1, 2, 3];
  const output = shuffle(input.slice());
  expect(output.sort()).toEqual(input.sort());
});
