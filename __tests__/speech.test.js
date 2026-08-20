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
    return {
      parseSpokenNumber, NUMBER_WORDS, matchesExpected, phoneticFold, fuzzyWordValue,
      setLang(l){ speechLang = l; }
    };`)();
}

const { parseSpokenNumber, NUMBER_WORDS, matchesExpected, phoneticFold, fuzzyWordValue, setLang } = loadParser();
const en = t => parseSpokenNumber(t, 'en-US');
const ca = t => parseSpokenNumber(t, 'ca-ES');
// The forgiving reading, the one only ever used to accept an answer.
const enF = t => parseSpokenNumber(t, 'en-US', { fuzzy: true });
const caF = t => parseSpokenNumber(t, 'ca-ES', { fuzzy: true });

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

// The recogniser rarely returns a clean number word. These are the shapes it
// actually produces, and the forgiving reading exists to survive them. Nothing
// here may change the strict reading, which is what gets recorded as the answer.
describe('the phonetic fold', () => {
  test('spellings of the same sound land on the same key', () => {
    expect(phoneticFold('two')).toBe(phoneticFold('too'));
    expect(phoneticFold('two')).toBe(phoneticFold('to'));
    expect(phoneticFold('four')).toBe(phoneticFold('for'));
    expect(phoneticFold('vuit')).toBe(phoneticFold('buit'));
    expect(phoneticFold('seixanta')).toBe(phoneticFold('seisanta'));
  });

  test('different numbers never fold onto one key', () => {
    ['en-US', 'ca-ES'].forEach(lang => {
      const byFold = new Map();
      Object.entries(NUMBER_WORDS[lang]).forEach(([word, value]) => {
        const key = phoneticFold(word);
        if(!byFold.has(key)) byFold.set(key, new Set());
        byFold.get(key).add(value);
      });
      const clashes = [...byFold.entries()].filter(([, values]) => values.size > 1);
      expect(clashes).toEqual([]);
    });
  });

  test('a word that is not a number at all folds onto nothing', () => {
    expect(fuzzyWordValue('elephant', NUMBER_WORDS['en-US'])).toBeUndefined();
    expect(fuzzyWordValue('', NUMBER_WORDS['en-US'])).toBeUndefined();
  });

  test('a sound caught between two numbers resolves to neither', () => {
    // "tue" is a plausible mishearing of two, but it is just as close to owe and
    // three. Guessing between them is how a child loses a rung they had won.
    expect(fuzzyWordValue('tue', NUMBER_WORDS['en-US'])).toBeUndefined();
  });
});

describe('the forgiving reading', () => {
  test('near misses the recogniser really returns still resolve', () => {
    expect(enF('sexty')).toBe(60);
    expect(enF('thirdy')).toBe(30);
    expect(enF('ninty')).toBe(90);
    expect(caF('cuaranta dos')).toBe(42);
    expect(caF('seisanta')).toBe(60);
    expect(caF('buitanta')).toBe(80);
  });

  test('words run together are pulled apart', () => {
    expect(enF('fortytwo')).toBe(42);
    expect(enF('sixtyfour')).toBe(64);
    expect(caF('quarantados')).toBe(42);
    expect(caF('vintiun')).toBe(21);
  });

  test('an ordinal or a stray letter beside the digits is ignored', () => {
    expect(en('42nd')).toBe(42);
    expect(en('x56')).toBe(56);
  });

  test('passing chatter is not turned into a number', () => {
    // Without an anchor — something in the utterance that already read as a
    // number — a loose phonetic match is just noise finding a number in speech.
    expect(enF('hello there')).toBeNaN();
    expect(caF('hola que tal')).toBeNaN();
    expect(enF('what was the question again')).toBeNaN();
  });

  test('it never loosens the strict reading', () => {
    expect(en('cuaranta dos')).toBeNaN();
    expect(ca('sexty')).toBeNaN();
    expect(en('sexty')).toBeNaN();
    expect(en('hello there')).toBeNaN();
  });

  test('a clean transcript reads the same either way', () => {
    ['56', 'fifty six', 'forty two', 'one hundred twenty', '1150'].forEach(txt => {
      expect(enF(txt)).toBe(en(txt));
    });
    ['56', 'cinquanta-sis', 'vint-i-un', 'mil cent cinquanta'].forEach(txt => {
      expect(caF(txt)).toBe(ca(txt));
    });
  });
});

describe('accepting an answer', () => {
  afterEach(() => setLang('en-US'));

  test('the top guess wins when it is right', () => {
    expect(matchesExpected(['42'], 42)).toBe(true);
    expect(matchesExpected(['forty two'], 42)).toBe(true);
  });

  test('a lower-ranked alternative can rescue a correct answer', () => {
    expect(matchesExpected(['party', 'forty', 'forty two'], 42)).toBe(true);
  });

  test('a mishearing that sounds like the answer is accepted', () => {
    expect(matchesExpected(['sexty'], 60)).toBe(true);
    setLang('ca-ES');
    expect(matchesExpected(['cuaranta dos'], 42)).toBe(true);
  });

  test('a different number is never accepted as the answer', () => {
    expect(matchesExpected(['forty three'], 42)).toBe(false);
    expect(matchesExpected(['24'], 42)).toBe(false);
    expect(matchesExpected(['thirty', 'thirty one'], 40)).toBe(false);
    setLang('ca-ES');
    expect(matchesExpected(['trenta'], 40)).toBe(false);
    expect(matchesExpected(['setze'], 60)).toBe(false);
  });

  test('no number at all is not an answer', () => {
    expect(matchesExpected(['hello there'], 3)).toBe(false);
    expect(matchesExpected([''], 5)).toBe(false);
  });

  test('every fact in the tables can be accepted when said plainly', () => {
    const words = ['zero','one','two','three','four','five','six','seven','eight','nine','ten',
      'eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
    const tens = { 20:'twenty', 30:'thirty', 40:'forty', 50:'fifty', 60:'sixty', 70:'seventy', 80:'eighty', 90:'ninety' };
    const say = n => {
      if(n < 20) return words[n];
      if(n < 100) return (tens[n - n % 10] + ' ' + (n % 10 ? words[n % 10] : '')).trim();
      return words[Math.floor(n / 100)] + ' hundred ' + (n % 100 ? say(n % 100) : '');
    };
    for(let a = 1; a <= 12; a++){
      for(let b = 1; b <= 12; b++){
        const answer = a * b;
        expect(matchesExpected([say(answer).trim()], answer)).toBe(true);
        expect(matchesExpected([String(answer)], answer)).toBe(true);
      }
    }
  });

  test('no product is accepted as any other product', () => {
    const seen = new Set();
    for(let a = 1; a <= 12; a++) for(let b = 1; b <= 12; b++) seen.add(a * b);
    const answers = [...seen];
    answers.forEach(spoken => {
      answers.forEach(expected => {
        if(spoken === expected) return;
        expect(matchesExpected([String(spoken)], expected)).toBe(false);
      });
    });
  });
});
