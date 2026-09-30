const fs = require('fs');
const path = require('path');

// Pulled out of index.html like the other suites, so there is no second copy.
function loadSpokenQuestion(){
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const start = html.indexOf('function spokenQuestion');
  const end   = html.indexOf('// Puts the question on screen');
  if(start === -1 || end === -1) throw new Error('spokenQuestion markers not found in index.html');
  return new Function(`${html.slice(start, end)}
    return spokenQuestion;`)();
}

const spokenQuestion = loadSpokenQuestion();

describe('reading a question aloud', () => {
  test('each operation is said the way a person would say it', () => {
    expect(spokenQuestion('7 × 8 = ?')).toBe('7 times 8');
    expect(spokenQuestion('56 ÷ 8 = ?')).toBe('56 divided by 8');
    expect(spokenQuestion('12 + 5 = ?')).toBe('12 plus 5');
    expect(spokenQuestion('17 − 5 = ?')).toBe('17 minus 5');
  });

  test('the "= ?" on screen is not read out', () => {
    expect(spokenQuestion('25 × 46 = ?')).toBe('25 times 46');
    expect(spokenQuestion('0 + 3')).toBe('0 plus 3');
  });
});
