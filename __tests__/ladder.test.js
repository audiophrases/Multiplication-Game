const fs = require('fs');
const path = require('path');

// The game ships as a single self-contained index.html, so pull the difficulty
// engine straight out of it rather than keeping a second copy in sync. The region
// between these markers is deliberately DOM-free.
function loadModel(){
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const start = html.indexOf('// ================= DIFFICULTY MODEL =================');
  const end   = html.indexOf('// One shot per rung:');
  if(start === -1 || end === -1) throw new Error('difficulty model markers not found in index.html');
  const src = html.slice(start, end);
  return new Function(`${src}
    return { FACT_ORDER, factScore, multiScore, difficulty, rungCenter, rungHalfWidth, rungWindow,
             rungShapes, rungPool, pickQuestion, zoneOf, LADDER_RUNGS,
             stats, recordAnswer, personalShift, personalDifficulty, trickiestFacts,
             MAX_SHIFT_UP, MAX_SHIFT_DOWN };`)();
}

const M = loadModel();

function resetStats(){
  Object.keys(M.stats.facts).forEach(k => delete M.stats.facts[k]);
  Object.keys(M.stats.shapes).forEach(k => delete M.stats.shapes[k]);
}
beforeEach(resetStats);
const rungs = Array.from({length: M.LADDER_RUNGS}, (_, i) => i + 1);
const singleDigitFacts = [];
for(let a = 1; a <= 10; a++) for(let b = a; b <= 10; b++) singleDigitFacts.push([a, b]);

describe('the authored fact order', () => {
  const canon = ([a, b]) => (a <= b ? `${a}x${b}` : `${b}x${a}`);

  test('covers all 55 unique facts exactly once', () => {
    const listed = M.FACT_ORDER.map(canon).sort();
    const expected = singleDigitFacts.map(canon).sort();
    expect(listed).toHaveLength(55);
    expect(new Set(listed).size).toBe(55);
    expect(listed).toEqual(expected);
  });

  test('score rises with position and spans the full 0-100 range', () => {
    const scores = M.FACT_ORDER.map(p => M.factScore(...p));
    for(let i = 1; i < scores.length; i++) expect(scores[i]).toBeGreaterThan(scores[i - 1]);
    expect(scores[0]).toBe(0);
    expect(scores[scores.length - 1]).toBe(100);
  });

  test('orientation does not change a fact\'s score', () => {
    M.FACT_ORDER.forEach(([a, b]) => expect(M.factScore(b, a)).toBe(M.factScore(a, b)));
  });
});

describe('single-digit fact ordering', () => {
  test('7x8 is the hardest fact and 1x1 the easiest', () => {
    const sorted = singleDigitFacts.slice().sort((x, y) => M.factScore(...x) - M.factScore(...y));
    expect(sorted[0]).toEqual([1, 1]);
    expect(sorted[sorted.length - 1]).toEqual([7, 8]);
    expect(M.factScore(1, 1)).toBe(0);
    expect(M.factScore(7, 8)).toBe(100);
  });

  test('the top tier is the hard core of the times table', () => {
    const hardest = singleDigitFacts
      .slice()
      .sort((x, y) => M.factScore(...y) - M.factScore(...x))
      .slice(0, 7)
      .map(([a, b]) => `${a}x${b}`)
      .sort();
    expect(hardest).toEqual(['4x8', '6x7', '6x8', '6x9', '7x8', '7x9', '8x9']);
  });

  test('size of the product does not decide difficulty', () => {
    expect(M.factScore(9, 9)).toBeLessThan(M.factScore(7, 8));
    expect(M.factScore(5, 10)).toBeLessThan(M.factScore(3, 4));
    expect(M.factScore(6, 6)).toBeLessThan(M.factScore(6, 8));   // squares are chunked
    expect(M.factScore(8, 8)).toBeLessThan(M.factScore(4, 8));
  });

  test('the x1 and x10 tables are cleared before anything else', () => {
    const blockTop = Math.max(...singleDigitFacts
      .filter(([a, b]) => a === 1 || b === 1 || a === 10 || b === 10)
      .map(p => M.factScore(...p)));
    const restBottom = Math.min(...singleDigitFacts
      .filter(([a, b]) => ![a, b].some(n => n === 1 || n === 10))
      .map(p => M.factScore(...p)));
    expect(blockTop).toBeLessThan(restBottom);
  });
});

describe('multi-digit difficulty', () => {
  test('is symmetric, so orientation is purely cosmetic', () => {
    const pairs = [[47, 3], [25, 46], [123, 4], [68, 79], [20, 30], [997, 11]];
    pairs.forEach(([a, b]) => expect(M.difficulty(a, b)).toBe(M.difficulty(b, a)));
  });

  test('carry load drives the ordering', () => {
    expect(M.multiScore(20, 30)).toBeLessThan(M.multiScore(15, 4));   // trailing zeros are a shift
    expect(M.multiScore(15, 4)).toBeLessThan(M.multiScore(34, 7));
    expect(M.multiScore(34, 7)).toBeLessThan(M.multiScore(25, 46));
    expect(M.multiScore(25, 46)).toBeLessThan(M.multiScore(68, 79));
    expect(M.multiScore(68, 79)).toBeLessThan(M.multiScore(487, 93));
  });

  test('every multi-digit question outranks every single-digit fact', () => {
    const hardestFact = Math.max(...singleDigitFacts.map(p => M.difficulty(...p)));
    [[20, 30], [11, 2], [12, 10], [99, 9]].forEach(([a, b]) =>
      expect(M.difficulty(a, b)).toBeGreaterThan(hardestFact));
  });
});

describe('ladder layout', () => {
  test('difficulty rises monotonically with every rung', () => {
    for(let r = 2; r <= M.LADDER_RUNGS; r++){
      expect(M.rungCenter(r)).toBeGreaterThan(M.rungCenter(r - 1));
    }
  });

  test('every rung has a non-empty question pool', () => {
    rungs.forEach(r => expect(M.rungPool(r).length).toBeGreaterThan(0));
  });

  test('candidate pools stay within reach of their rung window', () => {
    rungs.forEach(r => {
      const [lo, hi] = M.rungWindow(r);
      M.rungPool(r).forEach(([a, b]) => {
        const d = M.difficulty(a, b);
        expect(d).toBeGreaterThanOrEqual(lo - M.MAX_SHIFT_UP);
        expect(d).toBeLessThanOrEqual(hi + M.MAX_SHIFT_DOWN);
      });
    });
  });

  test('no multi-digit question appears before the times table is cleared', () => {
    for(let r = 1; r <= 18; r++){
      M.rungPool(r).forEach(([a, b]) => {
        expect(a).toBeLessThanOrEqual(10);
        expect(b).toBeLessThanOrEqual(10);
      });
    }
  });

  test('the summit reaches two-digit-by-two-digit work', () => {
    const summit = M.rungPool(29).concat(M.rungPool(30));
    expect(summit.some(([a, b]) => a >= 10 && b >= 10)).toBe(true);
    // 25 x 46, the shape asked for at the top of the ladder
    expect(M.difficulty(25, 46)).toBeGreaterThan(M.rungCenter(27));
  });

  test('rung 18 serves the hard core and nothing softer', () => {
    // What the rung actually asks, not what its widened candidate pool stocks.
    const [lo, hi] = M.rungWindow(18);
    const served = M.rungPool(18)
      .filter(([a, b]) => M.difficulty(a, b) >= lo && M.difficulty(a, b) <= hi)
      .map(([a, b]) => (a <= b ? `${a}x${b}` : `${b}x${a}`))
      .sort();
    ['6x7', '6x8', '7x8'].forEach(f => expect(served).toContain(f));
    // Every one of them comes from the top tenth of the authored order.
    served.forEach(f => expect(M.factScore(...f.split('x').map(Number))).toBeGreaterThan(85));
  });

  test('with no history, pickQuestion returns a question in the rung window', () => {
    rungs.forEach(r => {
      const [lo, hi] = M.rungWindow(r);
      for(let i = 0; i < 40; i++){
        const d = M.difficulty(...M.pickQuestion(r));
        expect(d).toBeGreaterThanOrEqual(lo);
        expect(d).toBeLessThanOrEqual(hi);
      }
    });
  });
});

describe('personal history', () => {
  const missMany = (a, b, n) => { for(let i = 0; i < n; i++) M.recordAnswer(a, b, false); };
  const hitMany  = (a, b, n) => { for(let i = 0; i < n; i++) M.recordAnswer(a, b, true); };

  test('an unseen question is unshifted', () => {
    expect(M.personalShift(6, 7)).toBe(0);
    expect(M.personalDifficulty(6, 7)).toBe(M.difficulty(6, 7));
  });

  test('a repeatedly missed fact moves up the ladder', () => {
    const before = M.personalDifficulty(3, 4);
    missMany(3, 4, 10);
    expect(M.personalDifficulty(3, 4)).toBeGreaterThan(before);
    expect(M.personalShift(3, 4)).toBeGreaterThan(15);
  });

  test('a mastered fact drifts down', () => {
    hitMany(7, 8, 12);
    expect(M.personalShift(7, 8)).toBeLessThan(0);
    expect(M.personalDifficulty(7, 8)).toBeLessThan(M.difficulty(7, 8));
  });

  test('one slip does not brand a fact as hard', () => {
    hitMany(6, 8, 8);
    const settled = M.personalShift(6, 8);
    M.recordAnswer(6, 8, false);
    expect(M.personalShift(6, 8) - settled).toBeLessThan(8);
  });

  test('the shift is bounded in both directions', () => {
    missMany(2, 3, 200);
    expect(M.personalShift(2, 3)).toBeLessThanOrEqual(M.MAX_SHIFT_UP);
    hitMany(4, 5, 200);
    expect(M.personalShift(4, 5)).toBeGreaterThanOrEqual(-M.MAX_SHIFT_DOWN);
  });

  test('history is symmetric: missing 3x4 also moves 4x3', () => {
    missMany(3, 4, 6);
    expect(M.personalShift(4, 3)).toBe(M.personalShift(3, 4));
  });

  test('wide questions are tracked by shape, not individually', () => {
    missMany(25, 46, 8);
    expect(M.personalShift(31, 57)).toBe(M.personalShift(25, 46));   // same 2d x 2d shape
    expect(M.personalShift(123, 4)).toBe(0);                          // different shape, untouched
  });

  test('a missed easy fact actually gets served on higher rungs', () => {
    const [a, b] = [3, 4];
    // Rungs that both stock this fact and would currently ask it.
    const servable = score => rungs.filter(r => {
      const [lo, hi] = M.rungWindow(r);
      const d = score(a, b);
      return d >= lo && d <= hi && M.rungPool(r).some(([x, y]) => x === a && y === b);
    });

    const before = servable(M.difficulty);
    expect(before.length).toBeGreaterThan(0);

    missMany(a, b, 20);
    const after = servable(M.personalDifficulty);
    expect(after.length).toBeGreaterThan(0);

    expect(Math.min(...after)).toBeGreaterThan(Math.min(...before));
    expect(Math.max(...after)).toBeGreaterThan(Math.max(...before));
  });

  test('pickQuestion honours personal difficulty when history exists', () => {
    missMany(3, 4, 20);
    const target = M.personalDifficulty(3, 4);
    const hostRung = rungs.find(r => {
      const [lo, hi] = M.rungWindow(r);
      return target >= lo && target <= hi && M.rungPool(r).some(([a, b]) => a === 3 && b === 4);
    });
    expect(hostRung).toBeDefined();
    const [lo, hi] = M.rungWindow(hostRung);
    for(let i = 0; i < 40; i++){
      const d = M.personalDifficulty(...M.pickQuestion(hostRung));
      expect(d).toBeGreaterThanOrEqual(lo);
      expect(d).toBeLessThanOrEqual(hi);
    }
  });

  test('trickiestFacts ranks by miss rate and ignores one-offs', () => {
    missMany(7, 8, 5);
    M.recordAnswer(6, 7, false); M.recordAnswer(6, 7, true); M.recordAnswer(6, 7, true);
    M.recordAnswer(2, 3, false);                 // single attempt, too little to judge
    const tricky = M.trickiestFacts(5);
    expect(tricky[0].key).toBe('7x8');
    expect(tricky.map(t => t.key)).toContain('6x7');
    expect(tricky.map(t => t.key)).not.toContain('2x3');
  });

  test('zones cover the whole ladder', () => {
    rungs.forEach(r => expect(M.zoneOf(r)).toBeDefined());
    expect(M.zoneOf(1).name).toBe('Ground');
    expect(M.zoneOf(30).name).toBe('Summit');
  });
});
