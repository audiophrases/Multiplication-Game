const fs = require('fs');
const path = require('path');

// Pulled out of index.html like the other suites, so there is no second copy of
// the engine to keep in step. Everything it leans on from the page — the browser
// constructor, the language, the mute flag, the debug readout — is supplied here.
function loadEngine(){
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const start = html.indexOf('  // ================= THE VOICE ENGINE');
  const end   = html.indexOf('  // Ends the question.');
  if(start === -1 || end === -1) throw new Error('voice engine markers not found in index.html');

  const sessions = [];
  function FakeRecognition(){
    this.lang = null;
    this.started = false;
    this.aborted = false;
    this.throwOnStart = false;
    this.onstart = this.onaudiostart = this.onspeechstart = null;
    this.onresult = this.onerror = this.onend = null;
    sessions.push(this);
  }
  // The browser throws here when a previous session has not finished letting go
  // of the device, and on a bad day accepts the call but never confirms it.
  FakeRecognition.refuseStarts = 0;
  FakeRecognition.confirmStarts = true;
  FakeRecognition.prototype.start = function(){
    if(FakeRecognition.refuseStarts > 0){
      FakeRecognition.refuseStarts--;
      throw new Error('InvalidStateError');
    }
    this.started = true;
    if(FakeRecognition.confirmStarts && this.onstart) this.onstart();
  };
  FakeRecognition.prototype.abort = function(){ this.aborted = true; };
  // Delivers one utterance as the browser would: a growing results list, with
  // resultIndex pointing at the first entry that changed.
  FakeRecognition.prototype.say = function(index, hypotheses, isFinal){
    if(!this._results) this._results = [];
    const alt = hypotheses.map(text => ({ transcript: text, confidence: 0.9 }));
    alt.isFinal = !!isFinal;
    this._results[index] = alt;
    const results = this._results.slice();
    results.length = Math.max(results.length, index + 1);
    if(this.onresult) this.onresult({ results, resultIndex: index });
  };
  FakeRecognition.prototype.fail = function(error){
    if(this.onerror) this.onerror({ error });
  };
  FakeRecognition.prototype.finish = function(){
    this.started = false;
    if(this.onend) this.onend();
  };

  const box = { micMuted: false, speechLang: 'en-US' };
  const engine = new Function('SpeechRecognition', 'box', `
    let micMuted, speechLang;
    const voiceDebug = { enabled:false, event(){}, heard(){} };
    const refresh = () => { micMuted = box.micMuted; speechLang = box.speechLang; };
    refresh();
    box.refresh = refresh;
    ${html.slice(start, end)}
    box.engine = VoiceEngine;
    return VoiceEngine;
  `)(FakeRecognition, box);

  // micMuted and speechLang are page-level state the engine reads; the closure
  // above copies them in, so the test pushes changes through the same door.
  const set = (key, value) => { box[key] = value; box.refresh(); };
  return {
    engine, sessions, set, Recognition: FakeRecognition,
    latest: () => sessions[sessions.length - 1]
  };
}

jest.useFakeTimers();

let engine, sessions, set, latest, Recognition;
beforeEach(() => {
  jest.clearAllTimers();
  ({ engine, sessions, set, latest, Recognition } = loadEngine());
});
afterEach(() => { engine.sleep(); });

const heard = () => {
  const calls = [];
  return {
    calls,
    onSpeech(hyps, isFinal){ calls.push({ hyps, isFinal }); },
    onTrouble(kind){ calls.push({ trouble: kind }); },
    onFatal(kind){ calls.push({ fatal: kind }); }
  };
};

describe('keeping the microphone warm', () => {
  test('priming opens a session before any question is asked', () => {
    engine.prime();
    expect(sessions).toHaveLength(1);
    expect(latest().started).toBe(true);
    expect(latest().lang).toBe('en-US');
    expect(latest().continuous).toBe(true);
    expect(latest().interimResults).toBe(true);
  });

  test('priming twice does not open a second session', () => {
    engine.prime();
    engine.prime();
    expect(sessions).toHaveLength(1);
  });

  test('a question between questions reuses the open session', () => {
    const first = heard();
    engine.listen(first);
    const opened = latest();
    engine.release();
    engine.listen(heard());
    expect(sessions).toHaveLength(1);
    expect(latest()).toBe(opened);
    expect(opened.aborted).toBe(false);
  });

  test('a session the browser ends is reopened immediately', () => {
    engine.prime();
    const first = latest();
    jest.advanceTimersByTime(1000);
    first.finish();
    jest.advanceTimersByTime(0);
    expect(sessions).toHaveLength(2);
    expect(latest()).not.toBe(first);
    expect(latest().started).toBe(true);
  });

  test('a start that throws is retried rather than left dead', () => {
    // Nothing calls onend for a start that never began, so the retry has to come
    // from the throw itself or the microphone stays dead for the whole question.
    Recognition.refuseStarts = 3;
    engine.prime();
    expect(latest().started).toBe(false);
    jest.advanceTimersByTime(2000);
    expect(sessions.length).toBe(4);
    expect(latest().started).toBe(true);
  });

  test('a session that keeps collapsing backs off instead of spinning', () => {
    engine.prime();
    for(let i = 0; i < 4; i++){
      latest().finish();                 // ends the instant it opened
      jest.advanceTimersByTime(0);
    }
    // Four collapses in no time at all, and it is waiting rather than hammering
    // the browser with a fresh session on every tick.
    expect(sessions.length).toBeLessThan(5);
    jest.advanceTimersByTime(2000);
    expect(latest().started).toBe(true);
  });

  test('an idle game gives the microphone back', () => {
    engine.listen(heard());
    engine.release();
    expect(latest().aborted).toBe(false);
    jest.advanceTimersByTime(20000);
    expect(latest().aborted).toBe(true);
    expect(engine.report().wanted).toBe(false);
  });

  test('the idle countdown is cancelled by the next question', () => {
    engine.listen(heard());
    engine.release();
    jest.advanceTimersByTime(19000);
    engine.listen(heard());
    jest.advanceTimersByTime(20000);
    expect(latest().aborted).toBe(false);
  });
});

describe('routing what it hears', () => {
  test('an armed question receives every hypothesis, interim and final', () => {
    const h = heard();
    engine.listen(h);
    latest().say(0, ['forty', 'party'], false);
    latest().say(0, ['forty two', 'party too'], true);
    expect(h.calls).toEqual([
      { hyps: ['forty', 'party'], isFinal: false },
      { hyps: ['forty two', 'party too'], isFinal: true }
    ]);
  });

  test('nothing is delivered between questions', () => {
    const h = heard();
    engine.listen(h);
    engine.release();
    latest().say(0, ['forty two'], true);
    expect(h.calls).toEqual([]);
  });

  test('an utterance from the previous question cannot answer the next one', () => {
    const first = heard();
    engine.listen(first);
    latest().say(0, ['forty'], false);          // still speaking when it settles
    engine.release();

    const second = heard();
    engine.listen(second);
    latest().say(0, ['forty two'], true);       // the old utterance, finalised late
    expect(second.calls).toEqual([]);

    latest().say(1, ['sixty'], true);           // a genuinely new one
    expect(second.calls).toEqual([{ hyps: ['sixty'], isFinal: true }]);
  });

  test('our own chime is not mistaken for an answer', () => {
    const h = heard();
    engine.listen(h);
    engine.deafen(600);
    latest().say(0, ['ding'], true);
    expect(h.calls).toEqual([]);
    jest.advanceTimersByTime(700);
    latest().say(1, ['forty two'], true);
    expect(h.calls).toEqual([{ hyps: ['forty two'], isFinal: true }]);
  });

  test('a handler that settles mid-event stops receiving the rest of it', () => {
    const calls = [];
    const h = {
      onSpeech(hyps){ calls.push(hyps); engine.release(); }
    };
    engine.listen(h);
    const rec = latest();
    rec._results = [];
    const one = [{ transcript: 'forty two' }]; one.isFinal = true;
    const two = [{ transcript: 'sixty' }];     two.isFinal = true;
    rec.onresult({ results: [one, two], resultIndex: 0 });
    expect(calls).toEqual([['forty two']]);
  });

  test('a fresh session starts counting utterances again', () => {
    const h = heard();
    engine.listen(h);
    latest().say(0, ['forty two'], true);
    latest().say(1, ['sixty'], true);
    jest.advanceTimersByTime(1000);
    latest().finish();
    jest.advanceTimersByTime(0);
    latest().say(0, ['eleven'], true);
    expect(h.calls[h.calls.length - 1]).toEqual({ hyps: ['eleven'], isFinal: true });
  });
});

describe('when things go wrong', () => {
  test('silence is not reported as a fault', () => {
    const h = heard();
    engine.listen(h);
    latest().fail('no-speech');
    expect(h.calls).toEqual([]);
    expect(engine.blocked()).toBe(null);
  });

  test('our own teardown is not reported as a fault', () => {
    const h = heard();
    engine.listen(h);
    latest().fail('aborted');
    expect(h.calls).toEqual([]);
  });

  test('a refused microphone is reported once and stops the retries', () => {
    const h = heard();
    engine.listen(h);
    latest().fail('not-allowed');
    latest().finish();
    jest.advanceTimersByTime(5000);
    expect(h.calls).toEqual([{ fatal: 'denied' }]);
    expect(engine.blocked()).toBe('denied');
    expect(sessions).toHaveLength(1);
  });

  test('a missing microphone is reported as its own thing', () => {
    const h = heard();
    engine.listen(h);
    latest().fail('audio-capture');
    expect(h.calls).toEqual([{ fatal: 'nomic' }]);
    expect(engine.blocked()).toBe('nomic');
  });

  test('a question armed after a refusal is told straight away', () => {
    engine.listen(heard());
    latest().fail('not-allowed');
    const next = heard();
    engine.listen(next);
    expect(next.calls).toEqual([{ fatal: 'denied' }]);
  });

  test('a dropped connection is reported but keeps trying', () => {
    const h = heard();
    engine.listen(h);
    latest().fail('network');
    latest().finish();
    jest.advanceTimersByTime(2000);
    expect(h.calls).toEqual([{ trouble: 'network' }]);
    expect(sessions.length).toBeGreaterThan(1);
  });

  test('a refusal can be taken back', () => {
    engine.listen(heard());
    latest().fail('not-allowed');
    expect(engine.report().wanted).toBe(false);
    engine.retry();
    expect(engine.blocked()).toBe(null);
    expect(latest().started).toBe(true);
  });

  test('a session that never opens is replaced', () => {
    Recognition.confirmStarts = false;   // accepted, but never actually begins
    engine.prime();
    const stuck = latest();
    jest.advanceTimersByTime(9000);
    expect(stuck.aborted).toBe(true);
    expect(sessions.length).toBeGreaterThan(1);
  });

  test('a session that goes silent for good is replaced', () => {
    engine.prime();
    const rec = latest();
    jest.advanceTimersByTime(20000);
    expect(rec.aborted).toBe(true);
    jest.advanceTimersByTime(300);
    expect(latest()).not.toBe(rec);
  });
});

describe('the language and the mute button', () => {
  test('switching language cycles the session', () => {
    engine.prime();
    const first = latest();
    set('speechLang', 'ca-ES');
    engine.relang();
    expect(first.aborted).toBe(true);
    jest.advanceTimersByTime(300);
    expect(latest().lang).toBe('ca-ES');
  });

  test('the same language leaves a running session alone', () => {
    engine.prime();
    const first = latest();
    engine.relang();
    expect(first.aborted).toBe(false);
    expect(sessions).toHaveLength(1);
  });

  test('muting hands the microphone back and stops the retries', () => {
    engine.prime();
    const rec = latest();
    set('micMuted', true);
    engine.sleep();
    expect(rec.aborted).toBe(true);
    jest.advanceTimersByTime(5000);
    expect(sessions).toHaveLength(1);
  });

  test('a muted microphone refuses to open', () => {
    set('micMuted', true);
    engine.prime();
    expect(sessions).toHaveLength(0);
    set('micMuted', false);
    engine.prime();
    expect(sessions).toHaveLength(1);
  });
});
