// Copies the OpenCascade WASM build (used to read STEP/IGES in the 3D viewer)
// from node_modules into public/, so Next serves it as a static file.
//
// Runs on postinstall, which Vercel and local installs both execute, so the
// 7.6 MB binary never has to live in git. It must never fail the install: if
// the package is missing the app still builds, STEP import just won't work.

const fs = require('fs')
const path = require('path')

const src = path.join(__dirname, '..', 'node_modules', 'occt-import-js', 'dist')
const dest = path.join(__dirname, '..', 'public', 'occt')
const files = ['occt-import-js.js', 'occt-import-js.wasm', 'license.occt.txt', 'license.occt-import-js.txt']

try {
  if (!fs.existsSync(src)) {
    console.warn('[copy-occt] occt-import-js not installed; STEP/IGES import will be unavailable.')
    process.exit(0)
  }
  fs.mkdirSync(dest, { recursive: true })
  for (const f of files) fs.copyFileSync(path.join(src, f), path.join(dest, f))
  console.log(`[copy-occt] copied ${files.length} files to public/occt`)
} catch (err) {
  console.warn('[copy-occt] could not copy OpenCascade files:', err.message)
}
