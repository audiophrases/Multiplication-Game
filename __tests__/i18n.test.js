const fs = require('fs');
const path = require('path');

// Pulled out of index.html like the other suites, so there is no second copy.
function loadStrings(){
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const start = html.indexOf('const STRINGS = {');
  const end   = html.indexOf('// Whatever screen is showing');
  if(start === -1 || end === -1) throw new Error('STRINGS markers not found in index.html');
  return new Function(`${html.slice(start, end)}
    return { STRINGS, t, setLang(l){ uiLang = l; } };`)();
}

const { STRINGS, t, setLang } = loadStrings();
const LANGS = Object.keys(STRINGS);
const EN = STRINGS['en-US'];

describe('the translation tables', () => {
  test('both languages are present', () => {
    expect(LANGS.sort()).toEqual(['ca-ES', 'en-US']);
  });

  test('Catalan covers every English key', () => {
    const missing = Object.keys(EN).filter(k => STRINGS['ca-ES'][k] === undefined);
    expect(missing).toEqual([]);
  });

  test('Catalan adds no keys English does not have', () => {
    const extra = Object.keys(STRINGS['ca-ES']).filter(k => EN[k] === undefined);
    expect(extra).toEqual([]);
  });

  test('a key is the same kind of thing in both languages', () => {
    const mismatched = Object.keys(EN).filter(k => {
      const a = EN[k], b = STRINGS['ca-ES'][k];
      if(typeof a !== typeof b) return true;
      if(Array.isArray(a) !== Array.isArray(b)) return true;
      if(typeof a === 'function' && a.length !== b.length) return true;   // same arity
      return false;
    });
    expect(mismatched).toEqual([]);
  });

  test('nothing is left as an untranslated copy of the English', () => {
    // Proper nouns and symbols are allowed to match; prose is not.
    const allowed = new Set(['op.div.name', 'summit', 'go']);
    const identical = Object.keys(EN).filter(k => {
      if(allowed.has(k) || typeof EN[k] !== 'string') return false;
      return EN[k] === STRINGS['ca-ES'][k] && /[a-z]{4}/i.test(EN[k]);
    });
    expect(identical).toEqual([]);
  });

  test('both celebration lists are non-empty and the same length', () => {
    LANGS.forEach(l => expect(STRINGS[l].celebrations.length).toBeGreaterThan(0));
    expect(STRINGS['ca-ES'].celebrations).toHaveLength(EN.celebrations.length);
  });
});

describe('lookup', () => {
  afterEach(() => setLang('en-US'));

  test('returns the active language', () => {
    setLang('ca-ES');
    expect(t('start')).toBe('Comença');
    setLang('en-US');
    expect(t('start')).toBe('Start');
  });

  test('interpolates arguments in each language\'s own word order', () => {
    setLang('en-US');
    expect(t('rungOf', 7, 30)).toBe('Rung 7 of 30');
    setLang('ca-ES');
    expect(t('rungOf', 7, 30)).toBe('Graó 7 de 30');
  });

  test('an unknown key returns itself rather than throwing', () => {
    expect(t('no.such.key')).toBe('no.such.key');
  });

  test('a gap in a translation falls back to English, not to a raw key', () => {
    const saved = STRINGS['ca-ES'].start;
    delete STRINGS['ca-ES'].start;
    setLang('ca-ES');
    expect(t('start')).toBe('Start');
    STRINGS['ca-ES'].start = saved;
  });

  test('every operation has a name, short name and blurb in both languages', () => {
    ['add','sub','mul','div'].forEach(op => {
      LANGS.forEach(l => {
        setLang(l);
        ['name','short','blurb'].forEach(part => {
          const val = t('op.' + op + '.' + part);
          expect(typeof val).toBe('string');
          expect(val.length).toBeGreaterThan(2);
        });
      });
    });
  });

  test('every zone name is translated', () => {
    ['Ground','Lower','Middle','Upper','Summit'].forEach(z => {
      setLang('ca-ES');
      const ca = t('zone.' + z);
      expect(typeof ca).toBe('string');
      expect(ca.length).toBeGreaterThan(1);
    });
  });
});
