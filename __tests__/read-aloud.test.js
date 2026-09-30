const fs = require('fs');
const path = require('path');

// Pulled out of index.html like the other suites, so there is no second copy.
function loadSpokenQuestion(){
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const start = html.indexOf('const SPOKEN_OPS');
  const end   = html.indexOf('// Puts the question on screen');
  if(start === -1 || end === -1) throw new Error('spokenQuestion markers not found in index.html');
  return new Function(`${html.slice(start, end)}
    return { spokenQuestion, SPOKEN_OPS };`)();
}

const { spokenQuestion, SPOKEN_OPS } = loadSpokenQuestion();

describe('reading a question aloud', () => {
  test('each operation is said the way a person would say it', () => {
    expect(spokenQuestion('7 × 8 = ?', 'en-US')).toBe('7 times 8');
    expect(spokenQuestion('56 ÷ 8 = ?', 'en-US')).toBe('56 divided by 8');
    expect(spokenQuestion('12 + 5 = ?', 'en-US')).toBe('12 plus 5');
    expect(spokenQuestion('17 − 5 = ?', 'en-US')).toBe('17 minus 5');
  });

  test('Catalan and French get their own words', () => {
    expect(spokenQuestion('7 × 8 = ?', 'ca-ES')).toBe('7 per 8');
    expect(spokenQuestion('56 ÷ 8 = ?', 'ca-ES')).toBe('56 dividit entre 8');
    expect(spokenQuestion('12 + 5 = ?', 'ca-ES')).toBe('12 més 5');
    expect(spokenQuestion('17 − 5 = ?', 'ca-ES')).toBe('17 menys 5');
    expect(spokenQuestion('7 × 8 = ?', 'fr-FR')).toBe('7 fois 8');
    expect(spokenQuestion('56 ÷ 8 = ?', 'fr-FR')).toBe('56 divisé par 8');
    expect(spokenQuestion('17 − 5 = ?', 'fr-FR')).toBe('17 moins 5');
  });

  test('every language covers every operation', () => {
    Object.keys(SPOKEN_OPS).forEach(lang =>
      expect(Object.keys(SPOKEN_OPS[lang]).sort()).toEqual(['+', '×', '÷', '−'].sort()));
  });

  test('an unknown language falls back to English', () => {
    expect(spokenQuestion('7 × 8 = ?', 'xx-XX')).toBe('7 times 8');
  });

  test('the "= ?" on screen is not read out', () => {
    expect(spokenQuestion('25 × 46 = ?', 'en-US')).toBe('25 times 46');
    expect(spokenQuestion('0 + 3', 'en-US')).toBe('0 plus 3');
  });
});
