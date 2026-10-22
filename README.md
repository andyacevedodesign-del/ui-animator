# UI Animator

Design small pieces of UI on a Figma-style canvas, give them animation presets,
drop them onto animated WebGL backgrounds, film them with a three.js camera, and
export MP4 / WebM / PNG. Built for showcasing new features.

```
npm install
npm run dev
```

## What you can do

- **Build UI like in Figma.** Frames with **auto layout** (row/column, gap,
  padding, align, hug), rectangles, ellipses, text (auto width / auto height /
  fixed), icons and images. Use smart guides, resize handles, marquee selection, nested
  selection (double-click to go deeper, Esc to go up), drag-to-reorder inside
  auto layout, and drag-and-drop for images. ⌘G frames the selection and ⇧A wraps it in
  auto layout.
- **Start from components:** feature card, toast, button, badge, stat card, chat
  message, search bar, toggle, checklist, progress, dialog, avatar stack, phone
  and browser frames. All are built with auto layout, so editing the text reflows them.
- **Animate with presets.** There are entrances (rise, pop, blur, zoom, spin, flip,
  bounce, wipes, iris, typewriter, count-up), emphasis (pulse, press, shake,
  wiggle, jump, tada, glow, sheen), loops (float, breathe, sway, spin, drift,
  blink, glow pulse, glint) and exits. Each preset has a start time, a length, a GSAP ease and a strength. On a
  frame, **stagger** plays the preset on each child in turn. **Recipes** apply common
  combinations in one click. You drag the bars on the timeline to retime them.
- **Backgrounds** come from Background Animator's effect modules (Perspective
  Grid, Infinity Cove, Aurora, Wave Lines, Clouds), plus **Blurred Summer**
  (out-of-focus flowers swaying in the wind under a drifting sky), **Mesh
  Gradient** and **Dot Grid**. The Scene tab shows them as a grid of named
  looks, and every parameter is editable.
- **Camera (three.js):** static, tilt reveal, push in, pull out, float, orbit,
  isometric, and focus on a layer. Top-level layers have **3D lift**, so they
  separate from the page when the camera tilts.
- **Cursor:** a scripted pointer or touch dot moves to layers and clicks
  them. Clicked layers press in, and a ripple plays.
- **Export** MP4 / WebM (WebCodecs + mediabunny) at 0.5×, 1× or 2×, 24, 30 or 60 fps, or the
  current frame as a PNG. Projects save as `.uianim.json` and autosave to the browser.

## How it works

```
project JSON ──► resolveFrame(project, t) ──► layout boxes + per-layer anim state + camera + cursor
                                                  │
     background effect (WebGL) ─┐                 ▼
     UI painted on Canvas 2D ───┼─► flat: straight into the output with the camera transform
                                │   3D:   one plane per lift depth, filmed by three.js
     cursor ────────────────────┴─► output canvas ──► preview · MP4/WebM · PNG
```

- `src/engine/model.ts` defines the data model. A project is plain JSON.
- `src/engine/layout.ts` implements auto layout.
- `src/engine/presets.ts` holds the presets. Each is a **pure function of
  progress**, with no tweens or clocks, so scrubbing is free and exports are frame-exact.
  Eases come from `gsap.parseEase`.
- `src/engine/paint.ts` paints the layers (shapes, gradients, shadows, text with typewriter and count-up,
  icons, images, sheen, glow).
- `src/engine/stage3d.ts` is the three.js camera, fitted so that zero tilt matches the flat render
  pixel for pixel.
- `src/engine/renderer.ts` composites everything. The editor and every exporter use it.
- `public/backgrounds/*.js` holds the effect modules (shared format with Background Animator).
  To add a background, drop a module there and list it in `src/engine/backgrounds.ts` and
  `src/library/backgrounds.ts`.

## Shortcuts

| Key | Action |
| --- | --- |
| V / F / R / O / T / H | Move, frame, rectangle, ellipse, text, hand |
| Space | Play / pause |
| ⌘Z / ⇧⌘Z | Undo / redo |
| ⌘D, ⌘C / ⌘V | Duplicate, copy / paste |
| ⌘G, ⇧A | Frame selection, auto-layout selection |
| Arrows (⇧ ×10) | Nudge |
| Enter / Esc | Select children / parent |
| ⌘/Ctrl + wheel | Zoom; wheel pans |
