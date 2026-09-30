// Reads STEP / IGES off the main thread so the page stays responsive while
// OpenCascade tessellates. occt-import-js.js and .wasm sit next to this file
// (copied from node_modules by scripts/copy-occt.js).
//
// The package ships its own worker, but it re-instantiates the 7.6 MB WASM on
// every message and uses relative paths; this one initialises once and uses
// absolute paths so it works from any page route.

importScripts('/occt/occt-import-js.js')

let occtPromise = null

onmessage = async (ev) => {
  const { id, format, buffer } = ev.data
  try {
    occtPromise = occtPromise || occtimportjs({ locateFile: (p) => '/occt/' + p })
    const occt = await occtPromise
    const result = occt.ReadFile(format, new Uint8Array(buffer), null)
    postMessage({ id, result })
  } catch (err) {
    postMessage({ id, error: String((err && err.message) || err) })
  }
}
