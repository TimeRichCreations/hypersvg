// An add-on's code, loaded when this release holds it. The core release leaves the built-in add-ons' code out (D30):
// a checker family or helper that only an add-on needs is imported here, and is null when its file is absent.
// Any other import error is thrown.
export async function optional(url) {
  try {
    return await import(url);
  } catch (e) {
    if (e?.code === 'ERR_MODULE_NOT_FOUND') return null;
    throw e;
  }
}
