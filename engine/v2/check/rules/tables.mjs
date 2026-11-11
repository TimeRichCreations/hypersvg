// Closed tables of section 8: which proof kinds each rule kind can give (8.9, A11.1), which kinds may be give-way (8.4)
// and the budget measures (A10.3).
export const PROOFS = {
  inside: ['files', 'playing'], clear: ['files', 'playing'], fits: ['files'], intrinsic: ['files'], relation: ['files'],
  'reading-order': ['files', 'playing'], limit: ['files'], keep: ['files', 'playing'], protected: ['files'],
  fonts: ['files'], colors: ['files'], readable: ['files'], contrast: ['files'], keyboard: ['files', 'playing'],
  'hit-target': ['files'], 'reduced-motion': ['playing'], focus: ['playing'], captions: ['files'], timing: ['files', 'playing'],
  'answers-spread': ['files'], feedback: ['playing'], scoring: ['files', 'playing'], 'on-route': ['files', 'playing'],
  solvable: ['playing'], 'prompt-limit': ['playing'], 'pause-offscreen': ['playing'], dismissible: ['playing'],
  budget: ['files'], 'no-copy': ['files'], judgement: ['review'],
};
export const GIVE_WAY_KINDS = new Set(['inside', 'clear', 'fits', 'intrinsic', 'relation', 'reading-order', 'limit', 'keep']);
export const BUDGET_MEASURES = new Set(['archiveBytes', 'unpackedBytes', 'files', 'fontBytes', 'soundBytes', 'videoBytes', 'lengthMs',
  'tableRows', 'repeatItems', 'pathsRewritten', 'suspendChars']);
export const ADDRESS = /^((part|place|field|input|value|use|scene|document|role|resource|color|data|play-test):[^\s]+|controls|graph|resources)$/;
