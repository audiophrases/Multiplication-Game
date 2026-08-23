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
// English is the table every other one is measured against, so it is not itself a
// translation. Every check below runs over all of these, not just the first one.
const TRANSLATIONS = LANGS.filter(l => l !== 'en-US');

// Words a language genuinely shares with English. Kept per language, so a real
// untranslated string can never hide behind another language's cognate.
const COGNATES = {
  'ca-ES': ['op.div.name'],
  'fr-FR': ['op.add.short', 'op.mul.name', 'op.mul.short',
            'op.div.name', 'op.div.short', 'menu']
};

describe('the translation tables', () => {
  test('every language the button offers is present', () => {
    expect(LANGS.sort()).toEqual(['ca-ES', 'en-US', 'fr-FR']);
  });

  test('every translation covers every English key', () => {
    TRANSLATIONS.forEach(l => {
      const missing = Object.keys(EN).filter(k => STRINGS[l][k] === undefined);
      expect({ [l]: missing }).toEqual({ [l]: [] });
    });
  });

  test('no translation adds keys English does not have', () => {
    TRANSLATIONS.forEach(l => {
      const extra = Object.keys(STRINGS[l]).filter(k => EN[k] === undefined);
      expect({ [l]: extra }).toEqual({ [l]: [] });
    });
  });

  test('a key is the same kind of thing in every language', () => {
    TRANSLATIONS.forEach(l => {
      const mismatched = Object.keys(EN).filter(k => {
        const a = EN[k], b = STRINGS[l][k];
        if(typeof a !== typeof b) return true;
        if(Array.isArray(a) !== Array.isArray(b)) return true;
        if(typeof a === 'function' && a.length !== b.length) return true;   // same arity
        return false;
      });
      expect({ [l]: mismatched }).toEqual({ [l]: [] });
    });
  });

  test('nothing is left as an untranslated copy of the English', () => {
    TRANSLATIONS.forEach(l => {
      const allowed = new Set(COGNATES[l] || []);
      const identical = Object.keys(EN).filter(k => {
        if(allowed.has(k) || typeof EN[k] !== 'string') return false;
        return EN[k] === STRINGS[l][k] && /[a-z]{4}/i.test(EN[k]);
      });
      expect({ [l]: identical }).toEqual({ [l]: [] });
    });
  });

  test('a listed cognate really is one, not a stale exemption', () => {
    // Otherwise the list quietly becomes a place to hide untranslated prose.
    TRANSLATIONS.forEach(l => {
      const stale = (COGNATES[l] || []).filter(k => EN[k] !== STRINGS[l][k]);
      expect({ [l]: stale }).toEqual({ [l]: [] });
    });
  });

  test('every celebration list is non-empty and the same length', () => {
    LANGS.forEach(l => expect(STRINGS[l].celebrations.length).toBeGreaterThan(0));
    TRANSLATIONS.forEach(l =>
      expect(STRINGS[l].celebrations).toHaveLength(EN.celebrations.length));
  });
});

describe('lookup', () => {
  afterEach(() => setLang('en-US'));

  test('returns the active language', () => {
    setLang('ca-ES');
    expect(t('start')).toBe('Comença');
    setLang('fr-FR');
    expect(t('start')).toBe('Commencer');
    setLang('en-US');
    expect(t('start')).toBe('Start');
  });

  test('interpolates arguments in each language\'s own word order', () => {
    setLang('en-US');
    expect(t('rungOf', 7, 30)).toBe('Rung 7 of 30');
    setLang('ca-ES');
    expect(t('rungOf', 7, 30)).toBe('Graó 7 de 30');
    setLang('fr-FR');
    expect(t('rungOf', 7, 30)).toBe('Barreau 7 sur 30');
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

  test('every zone name is translated in every language', () => {
    TRANSLATIONS.forEach(l => {
      setLang(l);
      ['Ground','Lower','Middle','Upper','Summit'].forEach(z => {
        const name = t('zone.' + z);
        expect(typeof name).toBe('string');
        expect(name.length).toBeGreaterThan(1);
      });
    });
  });
});
