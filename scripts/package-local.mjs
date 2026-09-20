import { build, Platform, Arch } from 'electron-builder';
import { resolve } from 'node:path';
import { buildRenderer } from './build.mjs';

// Reuse the exact installed Electron runtime instead of downloading it again.
await buildRenderer({ production: true });
await build({
  targets: Platform.WINDOWS.createTarget('portable', Arch.x64),
  config: { electronDist: resolve('node_modules/electron/dist'), npmRebuild: false },
});
