const fs = require('fs');
const path = require('path');

// Pulled straight out of index.html, same as the ladder tests, so the game stays
// a single self-contained file with no duplicated logic.
function loadParser(){
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const start = html.indexOf('// Spoken number words per language.');
  const end   = html.indexOf('function listenForNumber');
  if(start === -1 || end === -1) throw new Error('number parser markers not found in index.html');
  return new Function(`let speechLang = 'en-US';
    ${html.slice(start, end)}
    return { parseSpokenNumber, NUMBER_WORDS };`)();
}

const { parseSpokenNumber, NUMBER_WORDS } = loadParser();
const en = t => parseSpokenNumber(t, 'en-US');
const ca = t => parseSpokenNumber(t, 'ca-ES');

describe('digits', () => {
  test('a spoken number returned as digits wins outright, in any language', () => {
    expect(en('56')).toBe(56);
    expect(ca('56')).toBe(56);
    expect(ca('el resultat és 1150')).toBe(1150);
  });
});

describe('English', () => {
  test('tens and units', () => {
    expect(en('fifty six')).toBe(56);
    expect(en('twenty-two')).toBe(22);
    expect(en('seventy two')).toBe(72);
    expect(en('sixteen')).toBe(16);
  });

  test('hundreds and thousands', () => {
    expect(en('one hundred twenty')).toBe(120);
    expect(en('two hundred fifty')).toBe(250);
    expect(en('a hundred')).toBe(100);
    expect(en('two thousand five hundred six')).toBe(2506);
    expect(en('one thousand one hundred fifty')).toBe(1150);
  });

  test('"and" joins rather than counting as a word', () => {
    expect(en('one hundred and twenty')).toBe(120);
  });

  test('homophones the recogniser actually returns', () => {
    expect(en('ate')).toBe(8);
    expect(en('won')).toBe(1);
    expect(en('for')).toBe(4);
    expect(en('fourty five')).toBe(45);
  });

  test('nothing numeric gives NaN rather than a wrong answer', () => {
    expect(en('hello there')).toBeNaN();
    expect(en('')).toBeNaN();
    expect(en(null)).toBeNaN();
  });
});

describe('Catalan', () => {
  test('units and teens', () => {
    expect(ca('set')).toBe(7);
    expect(ca('vuit')).toBe(8);
    expect(ca('nou')).toBe(9);
    expect(ca('setze')).toBe(16);
    expect(ca('dinou')).toBe(19);
  });

  test('hyphenated compounds', () => {
    expect(ca('vint-i-un')).toBe(21);
    expect(ca('vint-i-dos')).toBe(22);
    expect(ca('cinquanta-sis')).toBe(56);
    expect(ca('quaranta-dues')).toBe(42);
    expect(ca('noranta-nou')).toBe(99);
  });

  test('the "i" joiner is not mistaken for a number', () => {
    expect(ca('trenta i sis')).toBe(36);
  });

  test('hundreds and thousands', () => {
    expect(ca('cent')).toBe(100);
    expect(ca('cent vint')).toBe(120);
    expect(ca('dos-cents cinquanta')).toBe(250);
    expect(ca('tres mil dos-cents')).toBe(3200);
    expect(ca('mil cent cinquanta')).toBe(1150);
  });

  test('feminine and dialect forms', () => {
    expect(ca('dues')).toBe(2);
    expect(ca('dues-centes')).toBe(200);
    expect(ca('huit')).toBe(8);
  });

  test('nothing numeric gives NaN', () => {
    expect(ca('hola')).toBeNaN();
  });
});

// Chrome regularly returns a mixture of digits and words for a single number.
// Reading only the first digit run, as this once did, threw away the rest.
describe('mixed digit and word transcripts', () => {
  test('a digit run and a word combine into one number', () => {
    expect(en('20 for')).toBe(24);      // twenty four
    expect(en('40 to')).toBe(42);       // forty two
    expect(en('fifty 6')).toBe(56);
    expect(en('30 nine')).toBe(39);
  });

  test('digits spelled out one at a time concatenate', () => {
    expect(en('1 5')).toBe(15);
    expect(en('3 6')).toBe(36);
    expect(en('two four')).toBe(24);
    expect(en('1 to')).toBe(12);
    expect(en('1 0 0')).toBe(100);
  });

  test('a number said as a whole still accumulates', () => {
    expect(en('one hundred twenty')).toBe(120);
    expect(en('two thousand five hundred six')).toBe(2506);
    expect(en('100')).toBe(100);
    expect(en('1150')).toBe(1150);
  });

  test('the homophones that started all this still resolve', () => {
    expect(en('to')).toBe(2);
    expect(en('too')).toBe(2);
    expect(en('for')).toBe(4);
    expect(en('won')).toBe(1);
    expect(en('ate')).toBe(8);
  });

  test('a spoken "number" prefix is accepted but never required', () => {
    expect(en('number 2')).toBe(2);
    expect(en('number twenty four')).toBe(24);
    expect(en('2')).toBe(en('number 2'));
    expect(ca('número vint-i-dos')).toBe(22);
    expect(ca('nombre cinquanta-sis')).toBe(56);
  });

  test('surrounding words are ignored rather than confusing the count', () => {
    expect(en('the answer is 56')).toBe(56);
    expect(en('um twenty four')).toBe(24);
  });

  test('Catalan mixes digits and words too', () => {
    expect(ca('20 i 4')).toBe(24);
    expect(ca('cinquanta 6')).toBe(56);
  });
});

describe('the two languages stay separate', () => {
  test('both cover every digit a product can be spoken with', () => {
    ['en-US', 'ca-ES'].forEach(lang => {
      const values = new Set(Object.values(NUMBER_WORDS[lang]));
      for(let n = 0; n <= 10; n++) expect(values).toContain(n);
      [20, 30, 40, 50, 60, 70, 80, 90, 100, 1000].forEach(n => expect(values).toContain(n));
    });
  });

  test('a Catalan answer is not silently parsed by the English map', () => {
    expect(en('vint-i-un')).toBeNaN();
  });
});
