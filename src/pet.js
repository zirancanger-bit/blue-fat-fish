import { createScene } from './scene.js';
import { pickLine } from './dialogue.js';
const bridge = window.fin,
  canvas = document.querySelector('#pet-canvas'),
  bubble = document.querySelector('#speech'),
  toolbar = document.querySelector('#pet-toolbar');
const data = await bridge.init();
document.querySelector('#retry-pet').addEventListener('click', () => bridge.retry());
let settings = data.settings,
  focus = data.focus,
  engine;
let speechTimer,
  hoverTimer,
  clickTimer,
  idleTimer,
  focusTimer,
  comboTimer,
  welcomeTimer,
  down = null,
  dragging = false,
  lastHit = null;
let soundContext,
  lastChime = 0;
function say(text, force = false) {
  if (!settings.speech && !force) return;
  clearTimeout(speechTimer);
  bubble.querySelector('p').textContent = text;
  bubble.classList.add('visible');
  speechTimer = setTimeout(
    () => bubble.classList.remove('visible'),
    6200 + Math.min(3500, text.length * 55),
  );
}
function chime(mood) {
  if (!settings.sound || performance.now() - lastChime < 180) return;
  lastChime = performance.now();
  try {
    const c = (soundContext ||= new AudioContext());
    if (c.state === 'suspended') c.resume();
    const o = c.createOscillator(),
      g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(mood === 'tailtap' ? 145 : mood === 'shy' ? 660 : mood === 'angry' ? 392 : 784, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(mood === 'tailtap' ? 75 : mood === 'shy' ? 880 : mood === 'angry' ? 294 : 1046.5, c.currentTime + 0.12);
    g.gain.setValueAtTime(0.001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.045, c.currentTime + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + (mood === 'tailtap' ? .14 : .35));
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + (mood === 'tailtap' ? .16 : .36));
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  } catch {}
}
function action(name) {
  if (!engine || dragging) return;
  engine.animator.play(name);
  if (['pet', 'tail', 'boop', 'wave'].includes(name))
    engine.burst(
      ['pet', 'tail', 'boop'].includes(name) ? 'heart' : 'star',
      name === 'star' ? 12 : 6,
    );
  say(pickLine(name));
  if(!['tail','tailtap'].includes(name))chime(name);
}
function touchAction(hit) {
  let object = hit?.object;
  while (object) {
    if (object.userData.touchAction) return object.userData.touchAction;
    if (object.name === 'nose') return 'boop';
    if (object.name === 'tail') return 'tailtap';
    object = object.parent;
  }
  return 'pet';
}
function pointerHit(x, y) {
  const b = toolbar.getBoundingClientRect();
  const ui =
    toolbar.classList.contains('visible') &&
    x >= b.left &&
    x <= b.right &&
    y >= b.top &&
    y <= b.bottom;
  return ui || Boolean(engine?.hitTest(x, y));
}
function setHit(value) {
  if (value !== lastHit) {
    lastHit = value;
    bridge.hit(value);
  }
  canvas.style.cursor = dragging ? 'grabbing' : value ? 'grab' : 'default';
}
try {
  engine = createScene(canvas, {
    theme: settings.theme,
    onEvent: (event, detail) => {
      if (event === 'tail-contact') chime('tailtap');
      if (event === 'catch') chime();
      if (event === 'drag-grip' && dragging && down) {
        // Ease from the pressed point to the visible tail. The native cursor
        // clock remains the sole owner of window movement.
        bridge.drag('anchor', {
          x: down.localX + (detail.x - down.localX) * detail.weight,
          y: down.localY + (detail.y - down.localY) * detail.weight,
        });
      }
    },
  });
  engine.applySettings(settings);
  bridge.on('action', action);
  bridge.on('combo', (combo) => {
    const badge = document.querySelector('#combo-badge');
    clearTimeout(comboTimer);
    badge.hidden = combo.count < 2;
    badge.classList.toggle('angry', combo.angry);
    badge.textContent = combo.angry ? '摸得鼓脸了 ×10' : `摸摸 ×${combo.count}`;
    comboTimer = setTimeout(() => (badge.hidden = true), 2000);
  });
  bridge.on('settings', (s) => {
    settings = s;
    engine.applySettings(s);
    if (!s.speech) bubble.classList.remove('visible');
  });
  bridge.on('stats', (stats) => {
    settings = { ...settings, stats };
  });
  bridge.on('cursor', (p) => {
    if (dragging && p.velocity) engine.animator.setDragVelocity(p.velocity.x, p.velocity.y);
    engine.animator.setPointer((p.x / p.width - 0.5) * 2, (0.5 - p.y / p.height) * 2);
    const hit = pointerHit(p.x, p.y);
    setHit(hit || dragging);
    if (hit && !dragging) {
      toolbar.classList.add('visible');
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => toolbar.classList.remove('visible'), 2200);
    }
  });
  // Forwarded mouse-move events wake hit testing immediately, before a fast click.
  window.addEventListener('mousemove', (e) => {
    if (dragging) return;
    const hit = pointerHit(e.clientX, e.clientY);
    setHit(hit);
    if (hit) {
      toolbar.classList.add('visible');
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => toolbar.classList.remove('visible'), 2200);
    }
  });
  window.addEventListener('mouseleave', () => {
    if (!dragging) setHit(false);
  });
  bridge.on('drag-ended', () => {
    if (dragging) {
      dragging = false;
      down = null;
      engine.animator.play('settle');
    }
  });
  bridge.on('roam', (direction) => {
    if (!dragging && !['sleep', 'tea'].includes(engine.animator.action)) {
      engine.animator.walkDirection = direction;
      engine.animator.play('walk');
    }
  });
  bridge.on('roam-stop', () => {
    if (engine.animator.action === 'walk') engine.animator.play('idle');
  });
  bridge.on('suspend', (v) => engine.setSuspended(v));
  bridge.on('focus', (f) => {
    focus = f;
    if (f.completed) {
      say('这一段完成了。给你摘一颗星，休息一下吧。', true);
      chime();
    }
  });
  canvas.addEventListener('pointerdown', (e) => {
    const hit = engine.hitTest(e.clientX, e.clientY);
    if (e.button !== 0 || !hit) return;
    down = {
      localX: e.clientX,
      localY: e.clientY,
      x: e.screenX,
      y: e.screenY,
      lastX: e.screenX,
      lastY: e.screenY,
      lastAt: performance.now(),
      id: e.pointerId,
      action: touchAction(hit),
    };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!down) return;
    if (!dragging && Math.hypot(e.screenX - down.x, e.screenY - down.y) > 6) {
      clearTimeout(clickTimer);
      dragging = true;
      engine.animator.play('drag');
      bubble.classList.remove('visible');
      toolbar.classList.remove('visible');
      bridge.drag('start', { x: down.localX, y: down.localY });
    }
  });
  const release = (e) => {
    if (!down) return;
    const wasDragging = dragging,
      touched = down.action;
    down = null;
    dragging = false;
    bridge.drag('end');
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    if (wasDragging) {
      engine.animator.play('settle');
    } else {
      clearTimeout(clickTimer);
      clickTimer = setTimeout(
        () => bridge.action(engine.animator.action === 'sleep' ? 'wake' : touched),
        240,
      );
    }
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', (e) => {
    clearTimeout(clickTimer);
    if (!down) return;
    down = null;
    dragging = false;
    bridge.drag('end');
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    engine.animator.play('settle');
  });
  canvas.addEventListener('dblclick', () => {
    clearTimeout(clickTimer);
    bridge.action('jump');
  });
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (engine.hitTest(e.clientX, e.clientY)) bridge.menu();
  });
  document.querySelector('#open-home').addEventListener('click', () => bridge.home());
  document.querySelector('#pet-menu').addEventListener('click', () => bridge.menu());
  for (const el of toolbar.querySelectorAll('button'))
    el.addEventListener('pointerenter', () => setHit(true));
  window.addEventListener('blur', () => {
    if (dragging) {
      dragging = false;
      down = null;
      bridge.drag('end');
      engine.animator.play('settle');
    }
  });
  idleTimer = setInterval(() => {
    if (!focus.active && engine.animator.action === 'idle' && settings.speech)
      say(pickLine('idle'));
  }, 150000);
  welcomeTimer = setTimeout(() => {
    if (data.activity === 'sleep') engine.animator.play('sleep');
    else {
      engine.animator.play('wave');
      say(pickLine('welcome'));
    }
  }, 450);
  focusTimer = setInterval(() => {
    const badge = document.querySelector('#focus-badge');
    badge.hidden = !focus.active;
    if (focus.active) {
      const left = Math.max(0, Math.ceil((focus.endAt - Date.now()) / 1000));
      badge.querySelector('b').textContent =
        `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
    }
  }, 1000);
  setHit(false);
  window.__FIN__ = {
    engine,
    action,
    say,
    get settings() {
      return settings;
    },
    get focus() {
      return focus;
    },
  };
} catch (error) {
  console.error(error);
  document.querySelector('#pet-fallback').hidden = false;
  bridge.hit(true);
}
window.addEventListener('beforeunload', () => {
  clearInterval(idleTimer);
  clearInterval(focusTimer);
  clearTimeout(welcomeTimer);
  clearTimeout(speechTimer);
  clearTimeout(hoverTimer);
  clearTimeout(clickTimer);
  clearTimeout(comboTimer);
  soundContext?.close();
  engine?.dispose();
});
