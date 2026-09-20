# Third-party notices

Fin uses desktop-window infrastructure adapted from Astra Desktop Pet. The original MIT copyright notice is preserved in LICENSE. The Fin character design was supplied by 荆棘 and modeled during this project; this notice does not grant a separate license to redistribute that character design.

Runtime components:
- Three.js 0.186.0, MIT. See licenses/THREE-LICENSE.txt.
- Electron 44.3.0, MIT, including Chromium and Node.js. LICENSE.electron.txt and LICENSES.chromium.html are bundled with the Electron runtime inside the portable application.

Build tools are Electron Builder and esbuild. Development versions are pinned in package.json. No build tools are required to run the portable application.

There are no downloaded character models, stock textures, remote fonts, or audio samples. Interaction tones are synthesized locally. No network connection is needed.
