const {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  Tray,
  Menu,
  nativeImage,
  powerMonitor,
  shell,
} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { randomBytes } = require('node:crypto');
const {
  normalize,
  migrateSettings,
  clampToWorkArea,
  petDimensions,
  roamPlan,
  dragAnchor,
} = require('./state.cjs');
const { MENU_ACTIONS, createPetCombo } = require('./interactions.cjs');
const petCombo = createPetCombo();
const { iconPNG } = require('./icon.cjs');
const qa = process.argv.includes('--qa');
const qaName = process.argv.find((arg) => /^--qa-name=[a-z0-9-]{1,32}$/.test(arg))?.slice(10);
const studio = process.argv.includes('--studio');
let qaCursor = null;
const cursorPoint = () => (qa && qaCursor ? { ...qaCursor } : screen.getCursorScreenPoint());
// An AppImage unpacks into a read-only mount: settings and photos belong next to
// the .AppImage file, and only fall back to the home directory when that
// location cannot be written.
function resolveRoot() {
  if (!app.isPackaged) return path.join(__dirname, '..');
  const candidates = [];
  if (process.env.PORTABLE_EXECUTABLE_DIR) candidates.push(process.env.PORTABLE_EXECUTABLE_DIR);
  if (process.env.APPIMAGE) candidates.push(path.dirname(process.env.APPIMAGE));
  candidates.push(path.dirname(process.execPath));
  for (const dir of candidates) {
    try {
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch {
      /* Try the next candidate. */
    }
  }
  return path.join(app.getPath('home'), '.blue-fat-fish');
}
const root = resolveRoot();
const dataDir = path.join(root, qa ? `qa/runtime${qaName ? `-${qaName}` : ''}` : 'data');
const photoDir = path.join(root, qa ? `qa/photos${qaName ? `-${qaName}` : ''}` : 'photos');
fs.mkdirSync(dataDir, { recursive: true });
app.setPath('userData', dataDir);
app.setAppUserModelId('local.fin.whalepet');
function logFailure(kind, details) {
  try {
    const file = path.join(dataDir, 'runtime-errors.log');
    if (fs.existsSync(file) && fs.statSync(file).size > 256 * 1024)
      fs.renameSync(file, path.join(dataDir, `runtime-errors-${Date.now()}.log`));
    fs.appendFileSync(file, `${new Date().toISOString()} ${kind} ${JSON.stringify(details)}\n`);
  } catch {
    /* Logging must never prevent startup or recovery. */
  }
}
app.on('child-process-gone', (_event, details) => {
  if (!['clean-exit', 'killed'].includes(details.reason)) logFailure('child-process', details);
});
// Click routing diagnostics. On Linux the pet window is transparent and mostly
// click-through, so a report of what the app believed about the pointer is the
// only way to tell a window-region problem from an interaction problem.
const clickDiagEnabled = qa || process.platform === 'linux' || process.argv.includes('--diag');
let clickDiagLast = 0;
function clickDiag(kind, details) {
  if (!clickDiagEnabled) return;
  const now = Date.now();
  if (kind === 'hit' && now - clickDiagLast < 200) return;
  if (kind === 'hit') clickDiagLast = now;
  try {
    const file = path.join(dataDir, 'click-diag.log');
    if (fs.existsSync(file) && fs.statSync(file).size > 128 * 1024)
      fs.renameSync(file, path.join(dataDir, `click-diag-${Date.now()}.log`));
    fs.appendFileSync(file, `${new Date().toISOString()} ${kind} ${JSON.stringify(details)}\n`);
  } catch {
    /* Diagnostics must never break the pet. */
  }
}
// Linux/X11 click-through. `setIgnoreMouseEvents` only reacts to cursor polling
// there (Chromium never forwards mouse moves on X11) and the switch races every
// click, so the pet window is instead given a static X11 region: the shape of
// everything it paints. Clicks on the pet then always land and clicks on the
// transparent area always fall through, with no timing involved.
const clickModePreference = process.env.FIN_CLICK_MODE;
let clickMode =
  process.platform === 'linux' && !studio && clickModePreference !== 'toggle' ? 'shape' : 'toggle';
let settings;
try {
  settings = migrateSettings(
    JSON.parse(fs.readFileSync(path.join(dataDir, 'settings.json'), 'utf8')),
  );
} catch {
  settings = normalize();
}
let pet,
  home,
  tray,
  cursorTimer,
  hitTimer,
  saveTimer,
  roamTimer,
  drag = null,
  quit = false,
  ignore = false;
let pendingAction = null;
let paused = false;
let roaming = null,
  sleeping = false,
  pointerOver = false,
  lastInteraction = Date.now();
let focus = { active: false, endAt: 0, duration: 25, completed: false };
const allowedActions = new Set([
  'pet',
  'wave',
  'jump',
  'shy',
  'tailtap',
  'sleep',
  'wake',
  'dance',
  'star',
  'think',
  'tail',
  'boop',
  'smile',
  'angry',
  'cool',
  'walk',
]);
function appIcon(size = 64) {
  const file = path.join(__dirname, `../assets/icons/fin-${size}.png`);
  return fs.existsSync(file)
    ? nativeImage.createFromPath(file)
    : nativeImage.createFromBuffer(iconPNG(size));
}
const eventSend = (name, value) => {
  for (const w of [pet, home])
    if (w && !w.isDestroyed())
      w.webContents.send(
        name,
        name === 'suspend' && w === home ? value || w.isMinimized() || !w.isVisible() : value,
      );
};
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const p = path.join(dataDir, 'settings.json');
      fs.writeFileSync(`${p}.tmp`, JSON.stringify(settings, null, 2));
      fs.renameSync(`${p}.tmp`, p);
    } catch (e) {
      console.error('Settings save failed:', e.message);
    }
  }, 350);
}
function dimensions(area) {
  return petDimensions(settings.size, area);
}
function stopRoam() {
  if (roaming) {
    roaming = null;
    eventSend('roam-stop');
  }
}
function placePet(bounds, area) {
  const wanted = clampToWorkArea(bounds, area);
  const before = pet.getBounds();
  if (Object.keys(wanted).some((k) => before[k] !== wanted[k])) pet.setBounds(wanted, false);
  const actual = pet.getBounds(),
    corrected = clampToWorkArea(actual, area);
  if (actual.x !== corrected.x || actual.y !== corrected.y)
    pet.setBounds({ ...wanted, x: corrected.x, y: corrected.y }, false);
}
function applyWindowLayer() {
  // Windows' "floating" level reorders behind the taskbar HWND, which can
  // remove topmost status when the shell taskbar is itself not topmost.
  // Bounds remain clamped to workArea, so this does not cover the taskbar.
  pet.setAlwaysOnTop(
    settings.alwaysOnTop,
    process.platform === 'win32' ? 'pop-up-menu' : 'floating',
  );
}
// The renderer reports what it paints (pet silhouette, overlays, particles).
// window shape = those rectangles, so the transparent area stays click-through.
let regionRects = [];
let shapeFailures = 0;
function sanitizeRegion(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const rect of value.slice(0, 512)) {
    const x = Math.round(Number(rect?.x)),
      y = Math.round(Number(rect?.y)),
      width = Math.round(Number(rect?.width)),
      height = Math.round(Number(rect?.height));
    if (![x, y, width, height].every(Number.isFinite)) continue;
    if (width < 1 || height < 1 || width > 4096 || height > 4096) continue;
    out.push({ x, y, width, height });
  }
  return out;
}
function applyRegionShape() {
  if (clickMode !== 'shape' || !pet || pet.isDestroyed() || !regionRects.length) return false;
  try {
    pet.setShape(regionRects);
    return true;
  } catch (error) {
    shapeFailures++;
    clickMode = 'toggle';
    logFailure('shape', { message: error.message });
    clickDiag('shape-failed', { message: error.message, rects: regionRects.length });
    return false;
  }
}
function setIgnore(next, source) {
  if (ignore === next) return;
  ignore = next;
  clickDiag('hit', { ignore: next, source });
  if (clickMode === 'shape') return; // the window region already routes clicks
  pet?.setIgnoreMouseEvents(next, { forward: true });
}
function regionHitAt(cursor) {
  if (!pet || pet.isDestroyed() || !regionRects.length) return null;
  const bounds = pet.getBounds(),
    x = cursor.x - bounds.x,
    y = cursor.y - bounds.y;
  if (x < 0 || y < 0 || x >= bounds.width || y >= bounds.height) return false;
  for (const rect of regionRects)
    if (x >= rect.x && y >= rect.y && x < rect.x + rect.width && y < rect.y + rect.height)
      return true;
  return false;
}
function moveDraggedPet(cursor) {
  if (!drag || !pet) return;
  placePet(
    {
      ...drag.bounds,
      x: drag.bounds.x + cursor.x - drag.cursor.x,
      y: drag.bounds.y + cursor.y - drag.cursor.y,
    },
    screen.getDisplayNearestPoint(cursor).workArea,
  );
}
function updateSettings(patch) {
  const old = settings;
  settings = normalize({ ...settings, ...patch, stats: { ...settings.stats, ...patch.stats } });
  if (!settings.roam) stopRoam();
  if (pet && !pet.isDestroyed()) {
    applyWindowLayer();
    pet.setOpacity(settings.opacity);
    if (old.size !== settings.size) {
      const b = pet.getBounds();
      const area = screen.getDisplayMatching(b).workArea;
      const d = dimensions(area);
      placePet(
        { ...d, x: b.x + Math.round((b.width - d.width) / 2), y: b.y + b.height - d.height },
        area,
      );
    }
  }
  eventSend('settings', settings);
  save();
  return settings;
}
function startRoam(manual = false) {
  if (!pet || pet.isDestroyed() || drag || paused) return false;
  stopRoam();
  const b = pet.getBounds(),
    area = screen.getDisplayMatching(b).workArea;
  const size = dimensions(area),
    plan = roamPlan({ ...b, ...size }, area, Math.random());
  if (!plan) return false;
  sleeping = false;
  if (manual) lastInteraction = Date.now();
  roaming = { ...plan, ...size, y: b.y, started: Date.now() };
  eventSend('roam', plan.direction);
  return true;
}
function doAction(action) {
  if (!allowedActions.has(action)) return false;
  if (action === 'walk') return startRoam(true);
  stopRoam();
  sleeping = action === 'sleep';
  lastInteraction = Date.now();
  if (['pet', 'tail', 'boop'].includes(action)) settings.stats.pets++;
  if (action === 'pet') {
    const combo = petCombo.touch(Date.now());
    eventSend('combo', combo);
    if (combo.angry) action = 'angry';
  }
  if (['star', 'jump'].includes(action)) settings.stats.stars++;
  if (pet?.webContents.isLoading()) pendingAction = action;
  else eventSend('action', action);
  eventSend('stats', settings.stats);
  save();
  return true;
}
function secure(win) {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) =>
    callback(false),
  );
  let lastRecovery = 0;
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('Renderer exited:', details.reason);
    if (!quit) logFailure('renderer-exit', details);
    if (
      !quit &&
      !win.isDestroyed() &&
      ['crashed', 'oom'].includes(details.reason) &&
      Date.now() - lastRecovery > 30000
    ) {
      lastRecovery = Date.now();
      setTimeout(() => {
        if (!quit && !win.isDestroyed()) win.webContents.reload();
      }, 700);
    }
  });
  win.webContents.on('console-message', (details) => {
    if (details.level === 'error') {
      console.error('Renderer:', details.message);
      logFailure('renderer', { message: details.message });
    }
  });
}
function createPet() {
  const savedDisplay =
    settings.x !== null && settings.y !== null
      ? screen.getDisplayNearestPoint({ x: settings.x, y: settings.y })
      : screen.getPrimaryDisplay();
  const area = savedDisplay.workArea,
    d = dimensions(area);
  const b = clampToWorkArea(
    {
      ...d,
      x: settings.x ?? area.x + area.width - d.width - 28,
      y: settings.y ?? area.y + area.height - d.height,
    },
    area,
  );
  pet = new BrowserWindow({
    ...b,
    title: '蓝色大肥鱼',
    frame: false,
    transparent: !studio,
    backgroundColor: studio ? '#171a2b' : '#00000000',
    resizable: false,
    movable: false,
    hasShadow: false,
    skipTaskbar: !studio,
    alwaysOnTop: settings.alwaysOnTop,
    icon: appIcon(),
    show: false,
    fullscreenable: false,
    maximizable: false,
    minimizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      spellcheck: false,
    },
  });
  secure(pet);
  applyWindowLayer();
  pet.setOpacity(settings.opacity);
  pet.loadFile(path.join(__dirname, '../dist/pet.html'), {
    query: { studio: String(studio), qa: String(qa) },
  });
  pet.once('ready-to-show', () => {
    const current = pet.getBounds();
    placePet(current, screen.getDisplayMatching(current).workArea);
    if (!(qa && process.argv.includes('--qa-hidden'))) pet.showInactive();
    applyWindowLayer();
    if (pendingAction) {
      eventSend('action', pendingAction);
      pendingAction = null;
    }
  });
  pet.on('closed', () => {
    pet = null;
    if (!quit && !qa) app.quit();
  });
  pet.on('moved', () => {
    if (!pet) return;
    const b = pet.getBounds();
    settings.x = b.x;
    settings.y = b.y;
    save();
  });
  pet.on('resize', () => applyRegionShape());
  pet.on('blur', () => {
    if (drag) {
      drag = null;
      pet.webContents.send('drag-ended');
    }
  });
}
function showHome() {
  if (home && !home.isDestroyed()) {
    home.show();
    home.focus();
    return;
  }
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const width = Math.min(1060, area.width - 32),
    height = Math.min(840, area.height - 32);
  home = new BrowserWindow({
    width,
    height,
    minWidth: Math.min(760, width),
    minHeight: Math.min(560, height),
    title: '蓝色大肥鱼 · 潮汐小屋',
    backgroundColor: '#f5f7fe',
    autoHideMenuBar: true,
    show: false,
    icon: appIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  secure(home);
  home.loadFile(path.join(__dirname, '../dist/home.html'), { query: { qa: String(qa) } });
  home.once('ready-to-show', () => home.show());
  home.on('minimize', () => home?.webContents.send('suspend', true));
  home.on('hide', () => home?.webContents.send('suspend', true));
  home.on('restore', () => home?.webContents.send('suspend', paused));
  home.on('show', () => home?.webContents.send('suspend', paused));
  home.on('closed', () => {
    home = null;
  });
}
function centerPet() {
  if (!pet) return;
  const a = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const d = dimensions(a);
  placePet({ ...d, x: a.x + Math.round((a.width - d.width) / 2), y: a.y + a.height - d.height }, a);
  pet.showInactive();
  pet.moveTop();
  applyWindowLayer();
  doAction('wave');
}
function popupMenu() {
  Menu.buildFromTemplate([
    { label: '蓝色大肥鱼 · 潮汐小屋', click: showHome },
    {
      label: '小表情',
      submenu: [
        { label: '害羞', click: () => doAction('shy') },
        { label: '微笑', click: () => doAction('smile') },
        { label: '生气', click: () => doAction('angry') },
        { label: '冷淡', click: () => doAction('cool') },
      ],
    },
    { type: 'separator' },
    {
      label: '眼芯颜色',
      submenu: [
        { label: '浅紫色', type: 'radio', checked: settings.irisColor === 'lavender', click: () => updateSettings({ irisColor: 'lavender' }) },
        { label: '红色', type: 'radio', checked: settings.irisColor === 'red', click: () => updateSettings({ irisColor: 'red' }) },
      ],
    },
    ...MENU_ACTIONS.map(([action, label]) => ({
      id: action,
      label,
      click: () => doAction(action),
    })),
    { type: 'separator' },
    {
      label: '桌边散步',
      type: 'checkbox',
      checked: settings.roam,
      click: (i) => updateSettings({ roam: i.checked }),
    },
    {
      label: '始终置顶',
      type: 'checkbox',
      checked: settings.alwaysOnTop,
      click: (i) => updateSettings({ alwaysOnTop: i.checked }),
    },
    {
      label: '互动音效',
      type: 'checkbox',
      checked: settings.sound,
      click: (i) => updateSettings({ sound: i.checked }),
    },
    { label: '回到鼠标所在屏幕', click: centerPet },
    { label: '重新加载桌宠', click: () => pet?.webContents.reload() },
    { type: 'separator' },
    {
      label: '退出桌宠',
      click: () => {
        quit = true;
        app.quit();
      },
    },
  ]).popup({ window: pet || home });
}
function wireIPC() {
  const isOur = (e) => [pet, home].some((w) => w && !w.isDestroyed() && e.sender === w.webContents);
  const handle = (name, fn) =>
    ipcMain.handle(name, (e, ...a) => {
      if (!isOur(e)) throw new Error('Unknown sender');
      return fn(e, ...a);
    });
  handle('fin:init', (e) => ({
    settings,
    focus,
    activity: sleeping ? 'sleep' : 'idle',
    version: app.getVersion(),
    desktop: e.sender === pet?.webContents,
    qa,
    diag: clickDiagEnabled,
  }));
  handle('fin:settings', (_e, patch) => {
    if (!patch || typeof patch !== 'object') return settings;
    return updateSettings(patch);
  });
  handle('fin:action', (_e, action) => doAction(action));
  handle('fin:home', () => showHome());
  handle('fin:center', () => centerPet());
  handle('fin:quit', () => {
    quit = true;
    app.quit();
  });
  handle('fin:photo', async (_e, dataURL) => {
    if (
      typeof dataURL !== 'string' ||
      !dataURL.startsWith('data:image/png;base64,') ||
      dataURL.length > 14000000
    )
      throw new Error('Invalid photo');
    const image = nativeImage.createFromDataURL(dataURL),
      size = image.getSize();
    if (image.isEmpty() || size.width > 2400 || size.height > 3000)
      throw new Error('Invalid photo dimensions');
    await fs.promises.mkdir(photoDir, { recursive: true });
    const d = new Date(),
      stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
    const fileName = `Fin-${stamp}-${randomBytes(3).toString('hex')}.png`,
      filePath = path.join(photoDir, fileName);
    await fs.promises.writeFile(filePath, image.toPNG(), { flag: 'wx' });
    return { fileName, filePath };
  });
  handle('fin:photos', async () => {
    await fs.promises.mkdir(photoDir, { recursive: true });
    const error = await shell.openPath(photoDir);
    if (error) throw new Error(error);
    return true;
  });
  handle('fin:focus', (_e, command, minutes) => {
    if (command === 'start') {
      if (focus.active) return focus;
      const d = Math.max(1, Math.min(120, Math.round(Number(minutes) || settings.focusMinutes)));
      focus = { active: true, endAt: Date.now() + d * 60000, duration: d, completed: false };
      doAction('think');
    } else if (command === 'stop') {
      if (!focus.active) return focus;
      focus = { ...focus, active: false, endAt: 0, completed: false };
    } else return focus;
    eventSend('focus', focus);
    return focus;
  });
  ipcMain.on('fin:hit', (e, hit) => {
    if (e.sender !== pet?.webContents || studio || drag) return;
    pointerOver = Boolean(hit);
    if (hit) {
      stopRoam();
      lastInteraction = Date.now();
    }
    // With a window region the main process owns the click-through state: the
    // renderer's raycast is a round trip behind the poll it is supposed to fix.
    if (clickMode === 'shape' || regionRects.length) return;
    setIgnore(!Boolean(hit), 'renderer');
  });
  ipcMain.on('fin:region', (e, rects) => {
    if (e.sender !== pet?.webContents || studio) return;
    const clean = sanitizeRegion(rects);
    if (!clean.length) return;
    const changed = clean.length !== regionRects.length ||
      clean.some((rect, i) => {
        const old = regionRects[i];
        return !old || old.x !== rect.x || old.y !== rect.y ||
          old.width !== rect.width || old.height !== rect.height;
      });
    regionRects = clean;
    if (!changed) return;
    clickDiag('region', { rects: clean.length, mode: clickMode });
    applyRegionShape();
  });
  ipcMain.on('fin:pointer', (e, kind, detail) => {
    if (e.sender !== pet?.webContents) return;
    clickDiag('pointer', { kind, detail, ignore, mode: clickMode });
  });
  ipcMain.on('fin:menu', (e) => {
    if (isOur(e)) popupMenu();
  });
  ipcMain.on('fin:retry', (e) => {
    if (e.sender === pet?.webContents) pet.webContents.reload();
  });
  ipcMain.on('fin:drag', (e, phase, point) => {
    if (e.sender !== pet?.webContents) return;
    if (phase === 'start') {
      stopRoam();
      if (sleeping && home && !home.isDestroyed()) home.webContents.send('action', 'wake');
      sleeping = false;
      lastInteraction = Date.now();
      const cursor = cursorPoint();
      const bounds = pet.getBounds();
      drag = {
        cursor: dragAnchor(bounds, point, cursor),
        bounds: { ...bounds, ...dimensions(screen.getDisplayMatching(bounds).workArea) },
        lastCursor: cursor,
        lastAt: Date.now(),
      };
      ignore = false;
      pet.setIgnoreMouseEvents(false);
      moveDraggedPet(cursor);
    }
    // Only the native cursor clock moves the window. Renderer mouse events
    // can be generated by window movement itself and arrive out of order.
    if (phase === 'anchor' && drag) {
      // The renderer only supplies the tail's local grip point, never a window
      // position. Rebase against the original bounds to avoid cumulative drift.
      drag.cursor = dragAnchor(drag.bounds, point, drag.cursor);
    }
    if (phase === 'end') {
      moveDraggedPet(cursorPoint());
      drag = null;
      const b = pet.getBounds();
      const area = screen.getDisplayMatching(b).workArea;
      placePet({ ...b, ...dimensions(area) }, area);
      save();
    }
  });
  if (qa)
    handle('fin:qa', () => ({
      bounds: pet?.getBounds(),
      settings,
      focus,
      ignore,
      dataDir,
      roaming,
      dragging: !!drag,
      clickMode,
      regionRects: regionRects.length,
      shapeFailures,
      menuActions: MENU_ACTIONS.map(([id]) => id),
    }));
  if (qa)
    handle('fin:qa-cursor', (_e, point) => {
      if (point === null) qaCursor = null;
      else if (point && Number.isFinite(point.x) && Number.isFinite(point.y))
        qaCursor = { x: point.x, y: point.y };
      return cursorPoint();
    });
}
const ownsInstance = qa || app.requestSingleInstanceLock();
if (!ownsInstance) app.quit();
else {
  app.on('second-instance', () => showHome());
  app.whenReady().then(() => {
    wireIPC();
    createPet();
    clickDiag('startup', {
      mode: clickMode,
      platform: process.platform,
      session: process.env.XDG_SESSION_TYPE || '',
      wayland: Boolean(process.env.WAYLAND_DISPLAY),
      root,
    });
    if (!qa) {
      tray = new Tray(appIcon(32));
      tray.setToolTip('蓝色大肥鱼 · 右键互动，双击打开潮汐小屋');
      tray.on('double-click', showHome);
      tray.on('click', showHome);
      tray.on('right-click', popupMenu);
    }
    settings.stats.visits++;
    save();
    cursorTimer = setInterval(() => {
      if (paused || !pet || pet.isDestroyed()) return;
      const cursor = cursorPoint();
      let b = pet.getBounds();
      let velocity = null;
      if (drag) {
        const now = Date.now(),
          dt = Math.max(0.008, (now - drag.lastAt) / 1000);
        velocity = {
          x: (cursor.x - drag.lastCursor.x) / dt / 950,
          y: (cursor.y - drag.lastCursor.y) / dt / 950,
        };
        drag.lastCursor = cursor;
        drag.lastAt = now;
        moveDraggedPet(cursor);
      }
      if (roaming && !drag) {
        const p = Math.min(1, (Date.now() - roaming.started) / roaming.duration);
        const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        const x = Math.round(roaming.fromX + (roaming.toX - roaming.fromX) * ease);
        // Explicit fixed dimensions prevent Windows fractional-DPI setPosition
        // from accumulating a larger backing surface on every movement.
        if (x !== b.x)
          pet.setBounds({ x, y: roaming.y, width: roaming.width, height: roaming.height }, false);
        if (p >= 1) stopRoam();
      }
      b = pet.getBounds();
      pet.webContents.send('cursor', {
        x: cursor.x - b.x,
        y: cursor.y - b.y,
        width: b.width,
        height: b.height,
        dragging: !!drag,
        velocity,
      });
      if (focus.active && Date.now() >= focus.endAt) {
        focus = { ...focus, active: false, completed: true };
        settings.stats.focusSessions++;
        save();
        doAction('star');
        // Deliver completion last so the generic star line does not replace it.
        eventSend('focus', focus);
      }
    }, 33);
    // Fallback click routing. When no window region can be applied (Wayland, or
    // a shape that the platform rejected) the toggle has to be driven from the
    // cursor clock here: going through the renderer costs an IPC round trip, and
    // a click that arrives inside that round trip still falls through.
    hitTimer = setInterval(() => {
      if (paused || !pet || pet.isDestroyed() || drag) return;
      if (clickMode === 'shape' || !regionRects.length) return;
      const hit = regionHitAt(cursorPoint());
      if (hit === null) return;
      pointerOver = hit;
      if (hit) {
        stopRoam();
        lastInteraction = Date.now();
      }
      setIgnore(!hit, 'region');
    }, 16);
    roamTimer = setInterval(() => {
      if (
        settings.roam &&
        !drag &&
        !sleeping &&
        !pointerOver &&
        !focus.active &&
        Date.now() - lastInteraction > 25000 &&
        pet?.isVisible()
      ) {
        startRoam();
      }
    }, 45000);
    const recover = () => {
      if (pet) {
        stopRoam();
        const b = pet.getBounds(),
          area = screen.getDisplayMatching(b).workArea;
        placePet({ ...b, ...dimensions(area) }, area);
        applyWindowLayer();
      }
    };
    screen.on('display-removed', recover);
    screen.on('display-metrics-changed', recover);
    powerMonitor.on('suspend', () => {
      paused = true;
      eventSend('suspend', true);
    });
    powerMonitor.on('resume', () => {
      recover();
      paused = false;
      eventSend('suspend', false);
    });
    powerMonitor.on('lock-screen', () => {
      paused = true;
      eventSend('suspend', true);
    });
    powerMonitor.on('unlock-screen', () => {
      paused = false;
      recover();
      eventSend('suspend', false);
    });
    if (studio || process.argv.includes('--home')) showHome();
  });
}
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => {
  quit = true;
  clearInterval(cursorTimer);
  clearInterval(hitTimer);
  clearInterval(roamTimer);
  clearTimeout(saveTimer);
  if (!ownsInstance) return;
  try {
    fs.writeFileSync(path.join(dataDir, 'settings.json'), JSON.stringify(settings, null, 2));
  } catch {}
});
