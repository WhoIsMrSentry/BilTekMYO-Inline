'use client';

import { useEffect, useRef } from 'react';

// Animated space backdrop. Colours come from the active theme: --galaxy-warm and --galaxy-cool.
type Point = { x: number; y: number };
type Star = Point & { size: number; phase: number; speed: number };
type Dust = { radius: number; angle: number; speed: number; size: number; sprite: HTMLCanvasElement };
type Dancer = { orbit: number; speed: number; phase: number; reach: number; tempo: number; size: number; color: string; sprite: HTMLCanvasElement; trail: Point[] };
type Streak = Point & { vx: number; vy: number; life: number };
type Spark = Point & { vx: number; vy: number; life: number; size: number; sprite: HTMLCanvasElement };
type Scene = { width: number; height: number; scale: number; backdrop: HTMLCanvasElement; galaxy: HTMLCanvasElement; stars: Star[]; dust: Dust[]; dancers: Dancer[] };

const tau = Math.PI * 2;
const squash = 0.46;
const tilt = -0.42;
const trailLength = 46;
const backdropMargin = 40;

const random = (from: number, to: number) => from + Math.random() * (to - from);
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]!;
const gauss = () => (Math.random() + Math.random() + Math.random()) / 1.5 - 1;

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width); canvas.height = Math.ceil(height);
  return canvas;
}
function paint(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable.');
  return context;
}
function glowSprite(color: string, size: number) {
  const canvas = makeCanvas(size, size);
  const context = paint(canvas);
  const glow = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  glow.addColorStop(0, '#fff');
  glow.addColorStop(0.16, color);
  glow.addColorStop(0.42, `${color}55`);
  glow.addColorStop(1, `${color}00`);
  context.fillStyle = glow;
  context.fillRect(0, 0, size, size);
  return canvas;
}
function paintBackdrop(width: number, height: number, warm: string[], cool: string[]) {
  const canvas = makeCanvas(width + backdropMargin * 2, height + backdropMargin * 2);
  const context = paint(canvas);
  context.globalCompositeOperation = 'lighter';
  const clouds = 16;
  for (let index = 0; index < clouds; index += 1) {
    const x = random(0, canvas.width); const y = random(0, canvas.height);
    const radius = random(0.18, 0.46) * Math.max(width, height);
    const color = pick(index % 2 ? warm : cool);
    const cloud = context.createRadialGradient(x, y, 0, x, y, radius);
    cloud.addColorStop(0, `${color}0e`);
    cloud.addColorStop(0.55, `${color}05`);
    cloud.addColorStop(1, `${color}00`);
    context.fillStyle = cloud;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  const stars = Math.round(canvas.width * canvas.height / 2100);
  for (let index = 0; index < stars; index += 1) {
    context.globalAlpha = random(0.12, 0.8);
    context.fillStyle = pick(['#fff', '#fff', '#ffd6dd', '#dcffcf']);
    const size = Math.random() > 0.97 ? 1.7 : 1;
    context.fillRect(random(0, canvas.width), random(0, canvas.height), size, size);
  }
  return canvas;
}
function paintGalaxy(size: number, warm: string[], cool: string[]) {
  const canvas = makeCanvas(size, size);
  const context = paint(canvas);
  const radius = size / 2;
  context.translate(radius, radius);
  context.globalCompositeOperation = 'lighter';
  const arms = 4;
  const haze = [glowSprite(warm[0]!, 150), glowSprite(cool[0]!, 150)];
  for (let arm = 0; arm < arms; arm += 1) {
    const palette = arm % 2 ? cool : warm;
    const start = arm * tau / arms;
    for (let index = 0; index < 90; index += 1) {
      const reach = Math.pow(Math.random(), 0.8);
      const angle = start + reach * 5.4 + gauss() * 0.22;
      context.globalAlpha = 0.06 * (1 - reach * 0.7);
      const stamp = random(70, 190) * (1.15 - reach * 0.5);
      context.drawImage(haze[arm % 2]!, Math.cos(angle) * reach * radius * 0.92 - stamp / 2, Math.sin(angle) * reach * radius * 0.92 - stamp / 2, stamp, stamp);
    }
    for (let index = 0; index < 1500; index += 1) {
      const reach = Math.pow(Math.random(), 1.5);
      const angle = start + reach * 5.4 + gauss() * (0.42 * (1 - reach) + 0.13);
      const distance = reach * radius * 0.96 + gauss() * radius * 0.02;
      context.globalAlpha = random(0.2, 0.8) * (1 - reach * 0.6);
      context.fillStyle = reach < 0.14 || Math.random() > 0.55 ? '#fff' : pick(palette);
      const dot = random(0.7, 2.1);
      context.fillRect(Math.cos(angle) * distance, Math.sin(angle) * distance, dot, dot);
    }
  }
  context.globalAlpha = 1;
  const core = context.createRadialGradient(0, 0, 0, 0, 0, radius * 0.3);
  core.addColorStop(0, '#ffffffee');
  core.addColorStop(0.1, '#ffe6d6aa');
  core.addColorStop(0.34, `${warm[0]}28`);
  core.addColorStop(0.64, `${cool[0]}0c`);
  core.addColorStop(1, `${cool[0]}00`);
  context.fillStyle = core;
  context.fillRect(-radius, -radius, size, size);
  return canvas;
}
function buildScene(width: number, height: number, warm: string[], cool: string[]): Scene {
  const scale = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(2_600_000 / (width * height)));
  const unit = Math.min(width, height) * 0.62;
  const dust: Dust[] = [];
  const dustCount = Math.round(Math.min(320, width * height / 5200));
  const dustSprites = [...warm, ...cool].map((color) => glowSprite(color, 24));
  for (let index = 0; index < dustCount; index += 1) {
    const radius = Math.pow(Math.random(), 0.7) * unit * 1.5 + unit * 0.08;
    dust.push({ radius, angle: random(0, tau), speed: random(0.5, 1.1) * 18 / Math.sqrt(radius), size: random(4, 14), sprite: pick(dustSprites) });
  }
  const dancers: Dancer[] = [];
  const pairs = width < 700 ? 3 : 5;
  for (let pair = 0; pair < pairs; pair += 1) {
    const orbit = unit * random(0.32, 1.45);
    const speed = random(0.06, 0.16) * (pair % 2 ? -1 : 1);
    const phase = random(0, tau);
    const reach = unit * random(0.05, 0.15);
    const tempo = random(0.5, 1.1);
    [pick(warm.slice(0, 2)), pick(cool.slice(0, 2))].forEach((color, side) => {
      const size = random(12, 26);
      dancers.push({ orbit, speed, phase: phase + side * Math.PI, reach, tempo, size, color, sprite: glowSprite(color, Math.round(size * 2)), trail: [] });
    });
  }
  const stars: Star[] = Array.from({ length: Math.round(width * height / 11000) }, () => ({ x: random(0, width), y: random(0, height), size: random(1, 2.6), phase: random(0, tau), speed: random(0.6, 2.4) }));
  return { width, height, scale, backdrop: paintBackdrop(width, height, warm, cool), galaxy: paintGalaxy(Math.min(1600, Math.max(width, height) * 1.25), warm, cool), stars, dust, dancers };
}

export function Galaxy({ interactive = false }: { interactive?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const theme = getComputedStyle(document.documentElement);
    const warm = theme.getPropertyValue('--galaxy-warm').trim().split(/\s+/);
    const cool = theme.getPropertyValue('--galaxy-cool').trim().split(/\s+/);
    const context = paint(canvas);
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let scene: Scene;
    let frameId = 0; let resizeTimer = 0;
    let last = performance.now(); let time = random(0, 200);
    let detail = 1; let slowFrames = 0; let frames = 0;
    let nextStreak = 2; let lastSpark = 0;
    const streaks: Streak[] = [];
    const sparks: Spark[] = [];
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const sparkSprites = [...warm.slice(0, 2), ...cool.slice(0, 2)].map((color) => glowSprite(color, 20));

    function resize() {
      const width = window.innerWidth; const height = window.innerHeight;
      scene = buildScene(width, height, warm, cool);
      canvas!.width = Math.round(width * scene.scale); canvas!.height = Math.round(height * scene.scale);
      if (still) draw(0);
    }

    function draw(delta: number) {
      const { width, height, backdrop, galaxy, stars, dust, dancers } = scene;
      const seconds = delta / 1000;
      const centerX = (width > 900 ? 0.68 : 0.5) * width + pointer.x * 16;
      const centerY = (width > 900 ? 0.44 : 0.34) * height + pointer.y * 12;
      const cosTilt = Math.cos(tilt); const sinTilt = Math.sin(tilt);
      const project = (radius: number, angle: number): Point => {
        const flatX = Math.cos(angle) * radius; const flatY = Math.sin(angle) * radius * squash;
        return { x: centerX + flatX * cosTilt - flatY * sinTilt, y: centerY + flatX * sinTilt + flatY * cosTilt };
      };

      context.setTransform(scene.scale, 0, 0, scene.scale, 0, 0);
      context.globalCompositeOperation = 'source-over';
      context.globalAlpha = 1;
      context.clearRect(0, 0, width, height);
      context.drawImage(backdrop, -backdropMargin + pointer.x * 7, -backdropMargin + pointer.y * 7);

      context.globalCompositeOperation = 'lighter';
      context.save();
      context.translate(centerX, centerY);
      context.rotate(tilt);
      context.scale(1, squash);
      context.rotate(time * 0.02);
      context.globalAlpha = 0.74 + Math.sin(time * 0.4) * 0.08;
      context.drawImage(galaxy, -galaxy.width / 2, -galaxy.height / 2);
      context.restore();

      for (const star of stars) {
        context.globalAlpha = 0.25 + 0.75 * Math.pow(0.5 + Math.sin(time * star.speed + star.phase) / 2, 3);
        context.fillStyle = '#fff';
        context.fillRect(star.x + pointer.x * 3, star.y + pointer.y * 3, star.size, star.size);
      }

      const visibleDust = Math.floor(dust.length * detail);
      for (let index = 0; index < visibleDust; index += 1) {
        const mote = dust[index]!;
        const point = project(mote.radius, mote.angle + time * mote.speed * 0.1);
        context.globalAlpha = 0.28 + 0.24 * Math.sin(time + index);
        context.drawImage(mote.sprite, point.x - mote.size / 2, point.y - mote.size / 2, mote.size, mote.size);
      }

      context.lineCap = 'round';
      for (const dancer of dancers) {
        const angle = dancer.phase * 0.5 + time * dancer.speed;
        const center = project(dancer.orbit, angle);
        const beat = time * dancer.tempo + dancer.phase;
        const swell = 1 + 0.4 * Math.sin(beat * 0.5);
        const head = { x: center.x + Math.cos(beat) * dancer.reach * swell, y: center.y + Math.sin(beat * 2) * dancer.reach * 0.62 * swell };
        const depth = 1 + 0.3 * Math.sin(angle);
        dancer.trail.push(head);
        if (dancer.trail.length > trailLength) dancer.trail.shift();
        context.strokeStyle = dancer.color;
        const step = detail < 0.7 ? 2 : 1;
        for (let index = step; index < dancer.trail.length; index += step) {
          const from = dancer.trail[index - step]!; const to = dancer.trail[index]!;
          const fade = index / dancer.trail.length;
          context.globalAlpha = fade * fade * 0.75;
          context.lineWidth = Math.max(0.6, fade * dancer.size * 0.16 * depth);
          context.beginPath(); context.moveTo(from.x, from.y); context.lineTo(to.x, to.y); context.stroke();
        }
        const size = dancer.size * depth * (1 + 0.14 * Math.sin(beat * 3));
        context.globalAlpha = 1;
        context.drawImage(dancer.sprite, head.x - size, head.y - size, size * 2, size * 2);
      }

      nextStreak -= seconds;
      if (nextStreak <= 0 && !still) {
        nextStreak = random(2.5, 7);
        const angle = random(0.25, 0.75); const pace = random(620, 1000);
        streaks.push({ x: random(-0.1, 0.8) * width, y: random(-0.1, 0.35) * height, vx: Math.cos(angle) * pace, vy: Math.sin(angle) * pace, life: 1 });
      }
      for (let index = streaks.length - 1; index >= 0; index -= 1) {
        const streak = streaks[index]!;
        streak.x += streak.vx * seconds; streak.y += streak.vy * seconds; streak.life -= seconds * 1.1;
        if (streak.life <= 0) { streaks.splice(index, 1); continue; }
        const tail = context.createLinearGradient(streak.x, streak.y, streak.x - streak.vx * 0.2, streak.y - streak.vy * 0.2);
        tail.addColorStop(0, '#fff');
        tail.addColorStop(0.3, `${index % 2 ? cool[1] : warm[0]}`);
        tail.addColorStop(1, 'transparent');
        context.globalAlpha = streak.life;
        context.strokeStyle = tail; context.lineWidth = 2;
        context.beginPath(); context.moveTo(streak.x, streak.y); context.lineTo(streak.x - streak.vx * 0.2, streak.y - streak.vy * 0.2); context.stroke();
      }

      for (let index = sparks.length - 1; index >= 0; index -= 1) {
        const spark = sparks[index]!;
        spark.x += spark.vx * seconds; spark.y += spark.vy * seconds;
        spark.vx *= 0.965; spark.vy *= 0.965; spark.life -= seconds * 1.15;
        if (spark.life <= 0) { sparks.splice(index, 1); continue; }
        context.globalAlpha = spark.life;
        context.drawImage(spark.sprite, spark.x - spark.size / 2, spark.y - spark.size / 2, spark.size, spark.size);
      }
    }

    function frame(now: number) {
      const delta = Math.min(now - last, 50);
      last = now; time += delta / 1000;
      pointer.x += (pointer.targetX - pointer.x) * 0.05;
      pointer.y += (pointer.targetY - pointer.y) * 0.05;
      draw(delta);
      // Lobby PCs differ a lot, so drop detail instead of dropping frames.
      frames += 1; if (delta > 30) slowFrames += 1;
      if (frames === 90) {
        if (slowFrames > 30) detail = Math.max(0.4, detail - 0.2);
        frames = 0; slowFrames = 0;
      }
      frameId = requestAnimationFrame(frame);
    }
    function spark(x: number, y: number, pace: number) {
      const angle = random(0, tau); const speed = random(0.2, 1) * pace;
      sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: random(0.5, 1), size: random(6, 18), sprite: pick(sparkSprites) });
    }
    function onPointerMove(event: PointerEvent) {
      pointer.targetX = event.clientX / window.innerWidth - 0.5;
      pointer.targetY = event.clientY / window.innerHeight - 0.5;
      if (event.timeStamp - lastSpark > 40) { lastSpark = event.timeStamp; spark(event.clientX, event.clientY, 60); }
    }
    function onPointerDown(event: PointerEvent) {
      for (let index = 0; index < 26; index += 1) spark(event.clientX, event.clientY, 360);
    }
    function onResize() {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, 200);
    }

    resize();
    window.addEventListener('resize', onResize);
    if (interactive && !still) {
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerdown', onPointerDown);
    }
    if (!still) frameId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(frameId);
      window.clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [interactive]);

  return <canvas aria-hidden="true" className="galaxy" ref={canvasRef} />;
}
