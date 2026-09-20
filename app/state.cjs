const DEFAULTS = Object.freeze({
  size: 1,
  theme: 'astral',
  costume: 'star',
  alwaysOnTop: true,
  roam: false,
  speech: true,
  sound: true,
  irisColor: 'lavender',
  settingsVersion: 2,
  followCursor: true,
  reducedMotion: false,
  quality: 'high',
  opacity: 1,
  x: null,
  y: null,
  focusMinutes: 25,
  stats: { pets: 0, stars: 0, focusSessions: 0, visits: 0 },
});
const finite = (n, fallback) => (Number.isFinite(n) ? n : fallback);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
function normalize(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) raw = {};
  const next = { ...DEFAULTS };
  for (const k of ['alwaysOnTop', 'roam', 'speech', 'sound', 'followCursor', 'reducedMotion']) {
    if (typeof raw[k] === 'boolean') next[k] = raw[k];
  }
  next.size = clamp(finite(raw.size, 1), 0.65, 1.5);
  next.opacity = clamp(finite(raw.opacity, 1), 0.45, 1);
  next.focusMinutes = Math.round(clamp(finite(raw.focusMinutes, 25), 1, 120));
  if (['astral', 'moon', 'aurora'].includes(raw.theme)) next.theme = raw.theme;
  if (['star', 'magistrate'].includes(raw.costume)) next.costume = raw.costume;
  if (['high', 'eco'].includes(raw.quality)) next.quality = raw.quality;
  if (['lavender', 'red'].includes(raw.irisColor)) next.irisColor = raw.irisColor;
  next.x = Number.isFinite(raw.x) ? Math.round(raw.x) : null;
  next.y = Number.isFinite(raw.y) ? Math.round(raw.y) : null;
  next.stats = { ...DEFAULTS.stats };
  for (const k of Object.keys(next.stats))
    next.stats[k] = Math.floor(clamp(finite(raw.stats?.[k], 0), 0, 10000000));
  return next;
}
function clampToWorkArea(bounds, area) {
  return {
    ...bounds,
    x: Math.round(clamp(bounds.x, area.x, area.x + Math.max(0, area.width - bounds.width))),
    y: Math.round(clamp(bounds.y, area.y, area.y + Math.max(0, area.height - bounds.height))),
  };
}
function petDimensions(size, area = { width: Infinity, height: Infinity }) {
  const scale = Math.min(clamp(finite(size, 1), 0.65, 1.5), area.width / 400, area.height / 490);
  return {
    width: Math.max(1, Math.floor(400 * scale)),
    height: Math.max(1, Math.floor(490 * scale)),
  };
}
function roamPlan(bounds, area, random = 0.5) {
  const left = bounds.x - area.x,
    right = area.x + area.width - bounds.width - bounds.x;
  let direction = random < 0.5 ? -1 : 1;
  if (direction < 0 && left < 35) direction = 1;
  if (direction > 0 && right < 35) direction = -1;
  const room = direction < 0 ? left : right;
  if (room < 20) return null;
  const distance = Math.min(room, 75 + Math.abs(random - 0.5) * 130);
  return {
    fromX: bounds.x,
    toX: Math.round(bounds.x + direction * distance),
    direction,
    duration: 5000,
  };
}
function migrateSettings(raw) {
  // 1.6 introduces audible feedback by default once. Subsequent explicit mute
  // choices survive restart, and normal settings patches never re-enable it.
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && raw.settingsVersion !== 2)
    return normalize({ ...raw, sound: true, settingsVersion: 2 });
  return normalize(raw);
}
function dragAnchor(bounds, point, fallback) {
  // Client coordinates and BrowserWindow bounds both use DIP. ScreenX from
  // Chromium can disagree across displays, and the native cursor may already
  // have reached the end of a fast gesture before the start IPC is processed.
  if (point && Number.isFinite(point.x) && Number.isFinite(point.y) &&
      point.x >= 0 && point.x <= bounds.width && point.y >= 0 && point.y <= bounds.height)
    return { x: bounds.x + point.x, y: bounds.y + point.y };
  return fallback;
}
module.exports = {
  dragAnchor,
  DEFAULTS,
  normalize,
  migrateSettings,
  clampToWorkArea,
  clamp,
  petDimensions,
  roamPlan,
};
