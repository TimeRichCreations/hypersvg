// The detail the host's error callback and the element's hsvg:error get (10.6, 10.16, D63): always a code and a
// message, with source and the fault's address, path or diagnostics when known. A failure with no code of its own (a
// listener that throws a plain Error, a store that fails, a file the page cannot fetch) is E-HOST-ERROR. Internal.
// A packed page does not carry this module: player-web.mjs gives its onError the same code inline.
export const errorDetail = (d) => {
  const x = d !== null && typeof d === 'object' ? d : { message: d };
  return { ...x, code: typeof x.code === 'string' && x.code ? x.code : 'E-HOST-ERROR', message: String(x.message ?? '') };
};
