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
    return { MUL_ORDER, ADD_ORDER, OPS, OP_KEYS, factScore, addFactScore, multiScore,
             addWideScore, addCarryCount, difficulty, rungCenter, rungHalfWidth, rungWindow,
             rungPool, pickQuestion, zoneOf, LADDER_RUNGS, SHAPES,
             stats, recordAnswer, personalShift, personalDifficulty, trickiestFacts,
             MAX_SHIFT_UP, MAX_SHIFT_DOWN };`)();
}

const M = loadModel();
const rungs = Array.from({length: M.LADDER_RUNGS}, (_, i) => i + 1);
const singleDigitFacts = [];
for(let a = 1; a <= 10; a++) for(let b = a; b <= 10; b++) singleDigitFacts.push([a, b]);

function resetStats(){
  M.OP_KEYS.forEach(k => {
    Object.keys(M.stats[k].facts).forEach(f => delete M.stats[k].facts[f]);
    Object.keys(M.stats[k].shapes).forEach(s => delete M.stats[k].shapes[s]);
  });
}
beforeEach(resetStats);

describe('the authored fact orders', () => {
  const canon = ([a, b]) => (a <= b ? `${a}x${b}` : `${b}x${a}`);

  test.each([['MUL_ORDER'], ['ADD_ORDER']])('%s covers all 55 unique facts exactly once', name => {
    const listed = M[name].map(canon).sort();
    expect(listed).toHaveLength(55);
    expect(new Set(listed).size).toBe(55);
    expect(listed).toEqual(singleDigitFacts.map(canon).sort());
  });

  test('multiplication score rises with position and spans 0-100', () => {
    const scores = M.MUL_ORDER.map(p => M.factScore(...p));
    for(let i = 1; i < scores.length; i++) expect(scores[i]).toBeGreaterThan(scores[i - 1]);
    expect(scores[0]).toBe(0);
    expect(scores[scores.length - 1]).toBe(100);
  });

  test('addition score rises with position and spans 0-100', () => {
    const scores = M.ADD_ORDER.map(p => M.addFactScore(...p));
    for(let i = 1; i < scores.length; i++) expect(scores[i]).toBeGreaterThan(scores[i - 1]);
    expect(scores[0]).toBe(0);
    expect(scores[scores.length - 1]).toBe(100);
  });

  test('orientation never changes a score', () => {
    M.MUL_ORDER.forEach(([a, b]) => expect(M.factScore(b, a)).toBe(M.factScore(a, b)));
    M.ADD_ORDER.forEach(([a, b]) => expect(M.addFactScore(b, a)).toBe(M.addFactScore(a, b)));
  });
});

describe('multiplication ordering', () => {
  test('7x8 is hardest and 1x1 easiest', () => {
    const sorted = singleDigitFacts.slice().sort((x, y) => M.factScore(...x) - M.factScore(...y));
    expect(sorted[0]).toEqual([1, 1]);
    expect(sorted[sorted.length - 1]).toEqual([7, 8]);
  });

  test('size of the product does not decide difficulty', () => {
    expect(M.factScore(9, 9)).toBeLessThan(M.factScore(7, 8));
    expect(M.factScore(5, 10)).toBeLessThan(M.factScore(3, 4));
    expect(M.factScore(6, 6)).toBeLessThan(M.factScore(6, 8));
  });

  test('the x1 and x10 tables are cleared before anything else', () => {
    const isBlock = ([a, b]) => [a, b].some(n => n === 1 || n === 10);
    const blockTop = Math.max(...singleDigitFacts.filter(isBlock).map(p => M.factScore(...p)));
    const restBottom = Math.min(...singleDigitFacts.filter(p => !isBlock(p)).map(p => M.factScore(...p)));
    expect(blockTop).toBeLessThan(restBottom);
  });
});

describe('addition ordering', () => {
  test('the classic hard facts sit at the top', () => {
    const hardest = singleDigitFacts
      .slice()
      .sort((x, y) => M.addFactScore(...y) - M.addFactScore(...x))
      .slice(0, 3)
      .map(([a, b]) => `${a}+${b}`)
      .sort();
    expect(hardest).toEqual(['6+8', '7+8', '7+9']);
  });

  test('crossing ten is what costs, not the size of the total', () => {
    expect(M.addFactScore(9, 10)).toBeLessThan(M.addFactScore(6, 8));   // 19 vs 14
    expect(M.addFactScore(10, 10)).toBeLessThan(M.addFactScore(5, 7));  // 20 vs 12
  });

  test('doubles are easier than their neighbours', () => {
    expect(M.addFactScore(7, 7)).toBeLessThan(M.addFactScore(7, 8));
    expect(M.addFactScore(8, 8)).toBeLessThan(M.addFactScore(7, 9));
  });

  test('carries are counted per column', () => {
    expect(M.addCarryCount(12, 3)).toBe(0);
    expect(M.addCarryCount(47, 68)).toBe(2);
    expect(M.addCarryCount(999, 999)).toBe(3);
  });

  test('wide addition is driven by carries', () => {
    expect(M.addWideScore(11, 2)).toBeLessThan(M.addWideScore(47, 68));
    expect(M.addWideScore(23, 45)).toBeLessThan(M.addWideScore(28, 45));  // same shape, one carry
    expect(M.addWideScore(47, 68)).toBeLessThan(M.addWideScore(678, 789));
  });
});

describe('multi-digit multiplication', () => {
  test('is symmetric, so orientation is cosmetic', () => {
    [[47, 3], [25, 46], [123, 4], [68, 79], [20, 30]].forEach(([a, b]) =>
      expect(M.difficulty(M.OPS.mul, a, b)).toBe(M.difficulty(M.OPS.mul, b, a)));
  });

  test('carry load drives the ordering', () => {
    expect(M.multiScore(20, 30)).toBeLessThan(M.multiScore(15, 4));
    expect(M.multiScore(34, 7)).toBeLessThan(M.multiScore(25, 46));
    expect(M.multiScore(25, 46)).toBeLessThan(M.multiScore(68, 79));
    expect(M.multiScore(68, 79)).toBeLessThan(M.multiScore(487, 93));
  });
});

describe.each(M.OP_KEYS)('the %s ladder', key => {
  const op = () => M.OPS[key];

  test('difficulty rises monotonically with every rung', () => {
    for(let r = 2; r <= M.LADDER_RUNGS; r++){
      expect(M.rungCenter(op(), r)).toBeGreaterThan(M.rungCenter(op(), r - 1));
    }
  });

  test('every rung has a non-empty pool', () => {
    rungs.forEach(r => expect(M.rungPool(op(), r).length).toBeGreaterThan(0));
  });

  test('every rung actually serves something inside its own window', () => {
    rungs.forEach(r => {
      const [lo, hi] = M.rungWindow(op(), r);
      const served = M.rungPool(op(), r).filter(([a, b, d]) => d >= lo && d <= hi);
      expect(served.length).toBeGreaterThan(0);
    });
  });

  test('no multi-digit question before the single-digit facts are cleared', () => {
    const factRungs = rungs.filter(r => op().shapes(r).length === 1 && op().shapes(r)[0] === '1x1');
    expect(factRungs.length).toBeGreaterThan(0);
    factRungs.forEach(r => M.rungPool(op(), r).forEach(([a, b]) => {
      expect(a).toBeLessThanOrEqual(10);
      expect(b).toBeLessThanOrEqual(10);
    }));
  });

  test('with no history, pickQuestion stays inside the rung window', () => {
    rungs.forEach(r => {
      const [lo, hi] = M.rungWindow(op(), r);
      for(let i = 0; i < 12; i++){
        const d = M.difficulty(op(), ...M.pickQuestion(op(), r));
        expect(d).toBeGreaterThanOrEqual(lo);
        expect(d).toBeLessThanOrEqual(hi);
      }
    });
  });

  test('every question it can ask has a whole, non-negative answer', () => {
    rungs.forEach(r => {
      M.rungPool(op(), r).slice(0, 60).forEach(([a, b]) => {
        [op().answer(a, b), op().answer(b, a)].forEach(answer => {
          expect(Number.isInteger(answer)).toBe(true);
          expect(answer).toBeGreaterThanOrEqual(0);
        });
      });
    });
  });

  test('the rendered question resolves to its own answer', () => {
    const [a, b] = M.pickQuestion(op(), 20);
    const text = op().render(a, b);
    const [, x, sym, y] = text.match(/^(\d+) (.) (\d+)$/);
    const table = { '+': (p, q) => p + q, '−': (p, q) => p - q, '×': (p, q) => p * q, '÷': (p, q) => p / q };
    expect(table[sym](Number(x), Number(y))).toBe(op().answer(a, b));
  });

  test('progress and history are namespaced, so operations never collide', () => {
    M.recordAnswer(op(), 3, 4, false);
    M.recordAnswer(op(), 3, 4, false);
    M.recordAnswer(op(), 3, 4, false);
    expect(M.personalShift(op(), 3, 4)).toBeGreaterThan(0);
    M.OP_KEYS.filter(k => k !== key).forEach(other =>
      expect(M.personalShift(M.OPS[other], 3, 4)).toBe(0));
  });
});

describe('inverse operations track their base fact', () => {
  test('division inherits the multiplication order', () => {
    expect(M.difficulty(M.OPS.div, 7, 8) - M.difficulty(M.OPS.mul, 7, 8))
      .toBe(M.difficulty(M.OPS.div, 2, 3) - M.difficulty(M.OPS.mul, 2, 3));
    expect(M.difficulty(M.OPS.div, 7, 8)).toBeGreaterThan(M.difficulty(M.OPS.div, 9, 9));
  });

  test('subtraction inherits the addition order', () => {
    expect(M.difficulty(M.OPS.sub, 6, 8)).toBeGreaterThan(M.difficulty(M.OPS.sub, 9, 10));
  });

  test('an inverse is never easier than the fact it undoes', () => {
    [[3, 4], [7, 8], [25, 46]].forEach(([a, b]) => {
      expect(M.difficulty(M.OPS.div, a, b)).toBeGreaterThan(M.difficulty(M.OPS.mul, a, b));
      expect(M.difficulty(M.OPS.sub, a, b)).toBeGreaterThan(M.difficulty(M.OPS.add, a, b));
    });
  });

  test('division is always exact and subtraction never goes negative', () => {
    [[3, 4], [7, 8], [25, 46], [123, 4], [997, 11]].forEach(([a, b]) => {
      expect((a * b) % b).toBe(0);
      expect(M.OPS.div.answer(a, b)).toBe(a);
      expect(M.OPS.sub.answer(a, b)).toBe(a);
      expect(a + b - b).toBe(a);
    });
  });
});

describe('personal history', () => {
  const mul = () => M.OPS.mul;
  const missMany = (a, b, n) => { for(let i = 0; i < n; i++) M.recordAnswer(mul(), a, b, false); };
  const hitMany  = (a, b, n) => { for(let i = 0; i < n; i++) M.recordAnswer(mul(), a, b, true); };

  test('an unseen question is unshifted', () => {
    expect(M.personalShift(mul(), 6, 7)).toBe(0);
    expect(M.personalDifficulty(mul(), 6, 7)).toBe(M.difficulty(mul(), 6, 7));
  });

  test('a repeatedly missed fact moves up, a mastered one drifts down', () => {
    missMany(3, 4, 10);
    expect(M.personalShift(mul(), 3, 4)).toBeGreaterThan(15);
    hitMany(7, 8, 12);
    expect(M.personalShift(mul(), 7, 8)).toBeLessThan(0);
  });

  test('one slip does not brand a fact as hard', () => {
    hitMany(6, 8, 8);
    const settled = M.personalShift(mul(), 6, 8);
    M.recordAnswer(mul(), 6, 8, false);
    expect(M.personalShift(mul(), 6, 8) - settled).toBeLessThan(8);
  });

  test('the shift is bounded in both directions', () => {
    missMany(2, 3, 200);
    expect(M.personalShift(mul(), 2, 3)).toBeLessThanOrEqual(M.MAX_SHIFT_UP);
    hitMany(4, 5, 200);
    expect(M.personalShift(mul(), 4, 5)).toBeGreaterThanOrEqual(-M.MAX_SHIFT_DOWN);
  });

  test('history is symmetric: missing 3x4 also moves 4x3', () => {
    missMany(3, 4, 6);
    expect(M.personalShift(mul(), 4, 3)).toBe(M.personalShift(mul(), 3, 4));
  });

  test('wide questions are tracked by shape, not individually', () => {
    missMany(25, 46, 8);
    expect(M.personalShift(mul(), 31, 57)).toBe(M.personalShift(mul(), 25, 46));
    expect(M.personalShift(mul(), 123, 4)).toBe(0);
  });

  test('a missed easy fact gets served on higher rungs', () => {
    const [a, b] = [3, 4];
    const servable = score => rungs.filter(r => {
      const [lo, hi] = M.rungWindow(mul(), r);
      const d = score(a, b);
      return d >= lo && d <= hi && M.rungPool(mul(), r).some(([x, y]) => x === a && y === b);
    });
    const before = servable((x, y) => M.difficulty(mul(), x, y));
    expect(before.length).toBeGreaterThan(0);
    missMany(a, b, 20);
    const after = servable((x, y) => M.personalDifficulty(mul(), x, y));
    expect(after.length).toBeGreaterThan(0);
    expect(Math.min(...after)).toBeGreaterThan(Math.min(...before));
    expect(Math.max(...after)).toBeGreaterThan(Math.max(...before));
  });

  test('trickiestFacts ranks by miss rate and ignores one-offs', () => {
    missMany(7, 8, 5);
    M.recordAnswer(mul(), 6, 7, false); M.recordAnswer(mul(), 6, 7, true); M.recordAnswer(mul(), 6, 7, true);
    M.recordAnswer(mul(), 2, 3, false);
    const tricky = M.trickiestFacts(mul(), 5);
    expect(tricky[0].label).toBe('7 × 8');
    expect(tricky.map(t => t.label)).not.toContain('2 × 3');
  });

  test('each operation labels its tricky facts in its own notation', () => {
    M.recordAnswer(M.OPS.sub, 6, 8, false); M.recordAnswer(M.OPS.sub, 6, 8, false);
    M.recordAnswer(M.OPS.div, 7, 8, false); M.recordAnswer(M.OPS.div, 7, 8, false);
    expect(M.trickiestFacts(M.OPS.sub, 1)[0].label).toBe('14 − 8');
    expect(M.trickiestFacts(M.OPS.div, 1)[0].label).toBe('56 ÷ 8');
  });
});
