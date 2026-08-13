const fs = require('fs');
const path = require('path');

// Pulled out of index.html, same as the other suites, so the game stays a single
// self-contained file with no duplicated logic.
function loadOrdering(){
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const start = html.indexOf('// ===== KEYPAD DIGIT ORDER =====');
  const end   = html.indexOf('// ===== END KEYPAD DIGIT ORDER =====');
  if(start === -1 || end === -1) throw new Error('keypad ordering markers not found in index.html');
  return new Function(`${html.slice(start, end)}
    return { applyDigit, applyBackspace, MAX_ANSWER_DIGITS };`)();
}

const { applyDigit, applyBackspace, MAX_ANSWER_DIGITS } = loadOrdering();

// Type a whole answer through the pad and return what the box ends up holding.
const type = (digits, unitsFirst) =>
  digits.split('').reduce((value, d) => applyDigit(value, d, unitsFirst), '');

describe('normal order', () => {
  test('digits land left to right', () => {
    expect(type('15678', false)).toBe('15678');
    expect(type('42', false)).toBe('42');
  });

  test('backspace removes the digit just entered', () => {
    expect(applyBackspace('156', false)).toBe('15');
    expect(applyBackspace('1', false)).toBe('');
    expect(applyBackspace('', false)).toBe('');
  });
});

describe('units first', () => {
  test('the answer to 34 x 68 can be entered right to left', () => {
    // 34 x 68 = 2312, worked out as ...2, ...1, ...3, ...2
    expect(type('2132', true)).toBe('2312');
  });

  test('15678 entered as 8, 7, 6, 5, 1', () => {
    const presses = ['8', '7', '6', '5', '1'];
    const seen = [];
    const final = presses.reduce((value, d) => {
      const next = applyDigit(value, d, true);
      seen.push(next);
      return next;
    }, '');
    expect(seen).toEqual(['8', '78', '678', '5678', '15678']);
    expect(final).toBe('15678');
  });

  test('a trailing zero in the answer survives being entered first', () => {
    // 240 is entered 0, 4, 2
    expect(type('042', true)).toBe('240');
    expect(parseInt(type('042', true), 10)).toBe(240);
  });

  test('backspace undoes the most recent digit, which is the leftmost one', () => {
    let value = type('876', true);      // 678
    expect(value).toBe('678');
    value = applyBackspace(value, true); // undo the 6 pressed last
    expect(value).toBe('78');
    value = applyBackspace(value, true);
    expect(value).toBe('8');
    value = applyBackspace(value, true);
    expect(value).toBe('');
    expect(applyBackspace('', true)).toBe('');
  });
});

describe('both orders agree on the rules', () => {
  test('length is capped the same either way', () => {
    const long = '123456789';
    expect(type(long, false)).toHaveLength(MAX_ANSWER_DIGITS);
    expect(type(long, true)).toHaveLength(MAX_ANSWER_DIGITS);
  });

  test('the cap leaves room for the largest answer the ladder can ask', () => {
    // rung 30 tops out around 997 x 90
    expect(String(997 * 90).length).toBeLessThanOrEqual(MAX_ANSWER_DIGITS);
  });

  test('a digit pressed at the cap is ignored rather than corrupting the value', () => {
    const full = type('1234567', true);
    expect(applyDigit(full, '9', true)).toBe(full);
    expect(applyDigit(full, '9', false)).toBe(full);
  });

  test('every answer the ladder can produce round-trips in units-first order', () => {
    [56, 240, 2312, 1150, 45291, 10967].forEach(answer => {
      const reversed = String(answer).split('').reverse().join('');
      expect(type(reversed, true)).toBe(String(answer));
    });
  });
});
