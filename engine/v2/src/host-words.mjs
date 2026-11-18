// Host words (added after 2.0.0-next.0): a host gives the words of one language the package has none for, so control
// labels and texts can show in the host's language. mount-web.mjs and asset-lean.mjs use it; a packed page does not.
// hostWords: {language, words: {<word id>: text}}. The words are checked as text:
// - language: a language tag the package has no words for (its default language included); else E-WORDS;
// - each id: a word id the package has in its default language; each text: a string of at most WORD_MAX characters
//   and at most twice its default word's length (never less than WORD_MIN), with no control characters. Else E-WORDS.
// Each owner of words (the experience, a scene, the shell, a component) gets the host's words for the ids it has, so a
// block's own words never hide them. An id the host leaves out keeps its default word (2.7).
// The checker never saw these words, so it could not fit-check them: they fit at play time only (7.6 fit, 8.4
// give-way steps). Returns the language, which the player makes the ambient language at the start.
const WORD_MAX = 400;
const WORD_MIN = 24;
const TAG = /^[a-z]{2,3}(-[A-Za-z0-9]{1,8}){0,3}$/;
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u2028\u2029]/;
const no = (message) => { const e = new Error(`host words: ${message}`); e.code = 'E-WORDS'; throw e; };

export function applyHostWords(experience, hostWords) {
  if (hostWords == null) return null;
  const { language, words } = hostWords;
  if (typeof language !== 'string' || !TAG.test(language)) no(`${JSON.stringify(language)} is not a language tag such as "fr" or "pt-BR"`);
  if (!words || typeof words !== 'object' || Array.isArray(words)) no('words maps a word id to its text');
  const base = experience.doc.language || 'en';
  const owners = [experience, experience.shell, ...Object.values(experience.scenes || {}), ...Object.values(experience.blocks || {})].filter(o => o?.words);
  const has = (o, lang) => Object.hasOwn(o.words, lang);
  if (language === base || owners.some(o => has(o, language))) no(`the package has its own words for ${language}`);
  const known = {};
  for (const o of owners) if (has(o, base)) for (const [id, t] of Object.entries(o.words[base])) known[id] = Math.max(known[id] ?? 0, String(t).length);
  const given = Object.create(null);
  for (const [id, text] of Object.entries(words)) {
    if (!Object.hasOwn(known, id)) no(`${id} is not a word of the package's ${base} words`);
    if (typeof text !== 'string') no(`${id} is not text`);
    if (CONTROL.test(text)) no(`${id} holds a control character`);
    const max = Math.min(WORD_MAX, Math.max(WORD_MIN, 2 * known[id]));
    if (text.length > max) no(`${id} is ${text.length} characters, more than ${max} (twice its ${base} word, at least ${WORD_MIN}, at most ${WORD_MAX})`);
    given[id] = text;
  }
  for (const o of owners) {
    if (!has(o, base)) continue;
    const mine = Object.assign(Object.create(null), o.words[base]);
    for (const id of Object.keys(mine)) if (Object.hasOwn(given, id)) mine[id] = given[id];
    o.words = { ...o.words, [language]: mine };
  }
  return language;
}
