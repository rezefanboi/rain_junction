# As the Droplets Fall — Complete Architecture & Implementation Spec
This document provides a highly detailed specification of the atmospheric, procedural 2.5D side-scrolling HTML5/JavaScript game **"As the Droplets Fall"**. With this specification, you will be able to reconstruct the entire application, code file by code file, including all mathematical curves, physics rules, audio synthesizers, and procedural render pipelines.

---

## 1. Project Directory & Component Roles
The project is built as a pure client-side web application without a bundler, sharing a global namespace `window.ER` (Endless Rain) to coordinate across script tags.

```
as-the-droplets-fall/
├── css/
│   └── style.css       # Core design tokens, layout styling, states, animations
├── js/
│   ├── ambient.js      # Fog cycles, lightning timers, thunder triggers
│   ├── audio.js        # Web Audio API synthesizers (no sound file dependencies)
│   ├── camera.js       # Spring-damped 2D follow camera
│   ├── collision.js    # Raindrop and car splash collision resolution
│   ├── game.js         # Game manager, fixed-timestep loop, state transitions
│   ├── input.js        # Keyboard and touch button event handlers
│   ├── main.js         # DOM loader bootstrap entry point
│   ├── player.js       # Auto-walking player state, walk cycle & jump curves
│   ├── puddles.js      # Ground puddle trigger detection
│   ├── rain.js         # Parallax rain layer simulations & splash particle pool
│   ├── render.js       # 2D Canvas rendering routines for all entities/backdrops
│   ├── road.js         # Procedural street elevation and slope formulas
│   ├── ui.js           # DOM binding, UI events, settings panel configuration
│   ├── umbrella.js     # Umbrella rotational inertia and shield math
│   ├── utils.js        # Mulberry32 deterministic PRNG, linear/damped math
│   ├── vehicles.js     # Background cars spawning and puddle-splashing logic
│   └── wind.js         # Wind states, angle interpolation, gust strength
└── index.html          # Document layout, game screens, HUD, script load order
```

---

## 2. DOM Layout & State Machine (`index.html` & `ui.js`)
The application manages its views using a single state attribute `data-state` on a wrapper `#frame`. The CSS styles react to this attribute to show or hide panels.

### Viewport Wrappers
* **`#stage`**: A fixed fullscreen container (`position: fixed; inset: 0`) centering the viewport.
* **`#frame`**: The core game container representing the active view space. It holds:
  * `<canvas id="canvas"></canvas>`: The drawing context.
  * `#title-screen`: The welcome screen containing the game title, a "by lace" credit, a bouncing "Tap anywhere to begin" instruction, and social links (GitHub, Instagram, Email).
  * `#hud-left` & `#hud-right`: Active gameplay HUD cards showing Distance ($m$), Dryness ($\%$, starting at $100\%$), Time ($mm:ss$), and a drop-down menu panel.
  * `#keyboard-hint`: Floating text instruction for desktop players: `Tilt the umbrella — A/D · Jump — Space`.
  * `#touch-controls`: Left, Right, and Jump buttons overlayed on mobile viewports.
  * `#pause-overlay`: A centered card with a "Continue walking" button appearing when the game is paused.
  * `#gameover-screen`: End-of-game overlay showing the final score, distance, and time metrics, with "Retry" and "Main Menu" buttons.

### UI State Transitions
The `data-state` attribute changes between three values:
1. `title`: The game renders a blurred, slowly panning backdrop. Tapping anywhere (excluding social links) fires `onStart()`, transitioning to `playing`.
2. `playing`: HUD panels slide in, auto-walk starts, keyboard/touch hints display briefly, and player inputs become active.
3. `ended`: Triggered when Dryness hits $0\%$. The player freezes, the screen blurs, and the Game Over statistics animate into view.

---

## 3. Visual Styling & Themes (`style.css`)
The CSS uses modern glassmorphism, responsive sizing, and state-based filters.

### Design Tokens (CSS Variables)
* Colors:
  * `--charcoal`: `#24272f` (Main background)
  * `--sky-1` & `--sky-2`: `#3d4759` & `#7d8794` (Dusk gradient)
  * `--off-white`: `#e6e8ec`
  * `--warm-white`: `#dcd6c8`
  * `--light-gray`: `#a7adb8`
  * `--cool-gray`: `#7d8591`
  * `--dark-gray`: `#4a505c`
  * `--accent`: `#8fa3bd`
* Glassmorphism utilities:
  * `--glass`: `rgba(230,232,236,0.14)`
  * `--glass-strong`: `rgba(28,31,38,0.62)`
  * `--glass-card`: `rgba(24,27,34,0.46)`
  * `--glass-border`: `rgba(230,232,236,0.16)`
  * `--text-soft`: `rgba(230,232,236,0.72)`

### Screen Effects
* **Blur Filter**: In states `title` and `ended`, the canvas element is blurred and scaled up slightly to avoid edge gaps:
  ```css
  #frame[data-state="title"] canvas,
  #frame[data-state="ended"] canvas {
    filter: blur(9px) brightness(0.78) saturate(0.9);
    transform: scale(1.035);
    transition: filter .9s ease, transform .9s ease;
  }
  ```
* **Vignette Layer**: Overlayed on title screens via a radial gradient:
  ```css
  background: radial-gradient(ellipse at 50% 40%, rgba(20,22,28,0.05), rgba(16,18,24,0.55) 85%);
  ```

### Animations
1. **Title Fade In (`title-fade-in`)**:
   - `from`: `opacity: 0; transform: translateY(14px)`
   - `to`: `opacity: 1; transform: translateY(0)`
2. **Tap Pulse (`tap-pulse`)**:
   - `0%, 100%`: `opacity: 0.6; transform: scale(1)`
   - `50%`: `opacity: 1; transform: scale(1.035)`
3. **Game Over Rise (`gameover-rise`)**:
   - `from`: `opacity: 0; transform: translateY(14px)`
   - `to`: `opacity: 1; transform: translateY(0)` (Delayed by $0.4\text{s}$)

---

## 4. Mathematics & Utility Functions (`utils.js`)

### Deterministic Randomness
Because world elements (trees, hills, mailboxes) must reload identically when walking forward or re-generating scenery chunks, the game utilizes a deterministic 32-bit PRNG (Mulberry32) seeded by chunk indices:
```javascript
mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

### Eased Damping
Rotational rates and camera movements use frame-rate independent dampening instead of linear updates:
$$\text{damp}(a, b, \lambda, dt) = \text{lerp}(a, b, 1 - e^{-\lambda \cdot dt})$$
```javascript
damp(a, b, lambda, dt) {
  return a + (b - a) * (1 - Math.exp(-lambda * dt));
}
```

---

## 5. Subsystem Details & Physics Specs

### Road Elevation (`road.js`)
The street elevation is procedural and calculated from the player's horizontal coordinate $x$:
$$\text{elevation}(x) = \sin(0.0012 \cdot x) \cdot 46 + \sin(0.0037 \cdot x + 1.7) \cdot 22 + \sin(0.0009 \cdot x + 4.1) \cdot 30$$
The slope at any point is evaluated using central difference with an offset $h = 4$:
$$\text{slope}(x) = \frac{\text{elevation}(x + h) - \text{elevation}(x - h)}{2h}$$

### Player Physics (`player.js`)
* **Speed**: Runs forward automatically at a constant velocity of $118$ world units per second.
* **Walking Animation**:
  * $\text{walkCycle} \mathrel{+}= dt \cdot (\text{speed} / 18)$
  * Body vertical bob: $\text{bob} = \sin(2 \cdot \text{walkCycle}) \cdot 3.2$
  * Leg angular swing: $\text{legSwing} = \sin(2 \cdot \text{walkCycle}) \cdot 10$
* **Floaty Jump Curve**:
  * Pressed trigger initiates jump lasting $\text{jumpDuration} = 0.42\text{s}$.
  * Position along the arc is $t \in [0, \text{jumpDuration}]$.
  * Vertical jump offset:
    $$y_{\text{offset}} = \sin\left(\pi \cdot \frac{t}{\text{jumpDuration}}\right) \cdot \text{jumpHeight}$$
    where $\text{jumpHeight} = 30\text{px}$.
* **Dryness Metric**: Starts at $100\%$ ($0$ wetness). If hit by rain or splashes, wetness increases. Wetness decays naturally at a rate of $3.4$ units per second when sheltered:
  $$\text{wetness} = \max(0, \text{wetness} - 3.4 \cdot dt)$$
  $$\text{dryness} = 100 - \text{wetness}$$

### Wind System (`wind.js`)
Modulates the angle of falling rain and causes visual hair/umbrella sway.
* **States**: Choices selected at random intervals ($6$ to $11$ seconds) from a set of angles:
  * `Far Left`: $-58^\circ$, `Left`: $-38^\circ$, `Slight Left`: $-16^\circ$, `Vertical`: $0^\circ$, `Slight Right`: $16^\circ$, `Right`: $38^\circ$, `Far Right`: $58^\circ$.
* **Smoothing**:
  - Current angle dampens toward the target: $\lambda = 0.6$.
  - Gust strength is computed based on how far the current angle is from target:
    $$\text{gustStrength} = \text{damp}\left(\text{gustStrength}, \frac{|\theta_{\text{target}} - \theta_{\text{current}}|}{60}, 3, dt\right)$$

### Umbrella Dynamics (`umbrella.js`)
* **Controls**: Active steering input (Left/Right axis) drives rotation.
* **Steering Velocity**:
  * Eases toward target speed ($\pm 150^\circ/\text{sec}$) with acceleration dampening ($\lambda = 11$).
  * Friction slows rotation when the controls are neutral (velocity scaled down by $\max(0, 1 - 4.6 \cdot dt)$).
* **Limits**: Umbrella tilt angle clamped between $-62^\circ$ and $+62^\circ$.
* **Collision Shielding Math (`shields(dx, dy)`)**:
  To check if a raindrop coordinates $(dx, dy)$ relative to the umbrella pivot $(0, 0)$ is blocked:
  1. Rotate the point by the negative tilt angle $-\theta$ into the local frame of the umbrella:
     $$rx = dx \cdot \cos(\theta) + dy \cdot \sin(\theta)$$
     $$ry = -dx \cdot \sin(\theta) + dy \cdot \cos(\theta)$$
  2. Test the **Shaft Region**:
     Blocked if $ry \in [-\text{canopyLength}, 0]$ AND $rx \in [-\text{canopyHalfWidth}, \text{canopyHalfWidth}]$, where $\text{canopyLength} = 58$ and $\text{canopyHalfWidth} = 21$.
  3. Test the **Dome Region** (semicircle centered at the top of the shaft):
     Blocked if $ry \le -\text{canopyLength} + \text{forgiveness}$ and distance to center is small:
     $$(rx)^2 + (ry - (-\text{canopyLength}))^2 \le (\text{canopyHalfWidth} + \text{forgiveness})^2$$
     where $\text{forgiveness} = 5\text{px}$.

### Collision Resolution (`collision.js`)
* **Player Bounding Box**:
  - Width: $30\text{px}$ (half-width $15$).
  - Height: $68\text{px}$ (relative to ground, from $y = \text{ground} - 68$ to $y = \text{ground} + 6$).
  - Pivot Height: $50\text{px}$ above ground.
* **Rain Collisions**:
  - Only scans 'mid' and 'fg' rain layers.
  - Drops outside a horizontal window of $\pm 70\text{px}$ from player are ignored.
  - If a drop passes the `shields` test, it is flagged as `hit` and neutralized.
  - If it misses the umbrella shield but falls inside the Player Bounding Box, it is flagged as a `hit`, and wetness increases:
    $$\text{wetness} \mathrel{+}= 1.6 \cdot \text{hits}$$

---

## 6. Procedural Scenery & World Generation (`world.js`)

### Roadside Scenery (Infinite Chunks)
* **Chunk Size**: Each chunk is $900$ world units wide.
* **Seed Function**: Generated on-demand based on chunk index.
* **Right Scenery Objects** (Weighted Distribution):
  * `house` (weight 3)
  * `tree` (weight 3)
  * `bush` (weight 3)
  * `fenceRun` (weight 2)
  * `mailbox` (weight 1)
  * `vending` (weight 1)
  * `bicycle` (weight 1)
  * `lampRight` (weight 1)
* **Left Scenery Objects** (Weighted Distribution):
  * `mirror` (weight 1)
  * `sign` (weight 1)
  * `lampLeft` (weight 1)
  * `none` (weight 3)

### Puddles & Splashes (`puddles.js`, `vehicles.js`)
* **Spawn Rate**: $60\%$ chance for $1$ puddle, $25\%$ chance for $2$ puddles, $15\%$ chance for $0$.
* **Puddle Size**: Width ranges from $34$ to $80$ units, depth ranges from $0.5$ to $1.0$.
* **Jump Mechanics**:
  - A puddle is checked when the player's $x$ coordinates overlap the puddle's width.
  - If the player is in the air (`isJumping === true`) at any point during the overlap, the puddle is marked as resolved/cleared, triggering splash particles and scoring.
  - If the player walks through without jumping, they miss, triggering a splash, and incurring a dryness penalty:
    $$\text{wetness} \mathrel{+}= 5$$
* **Vehicles**:
  - Spawns a vehicle every $9$ to $19$ seconds travelling left or right at speed $70\text{--}125$ units/sec.
  - As vehicles cross a puddle, they trigger splashing particles and spray the player if nearby (within $95\text{px}$ radius). This splash bypasses the umbrella unless tilted towards the car, adding $4$ wetness points.

---

## 7. Web Audio API Synthesis Spec (`audio.js`)
The game contains no audio asset files. Sounds are synthesized programmatically.

### The Sound Synthesizers
1. **Rain Bed**:
   - Creates a 2-second white noise buffer filled with random values between $-1.0$ and $+1.0$.
   - Runs two continuous loop nodes:
     * *Near Layer*: Noise $\to$ Highpass filter ($1800\text{Hz}$) $\to$ Gain ($0.05$).
     * *Far Layer*: Noise $\to$ Lowpass filter ($700\text{Hz}$) $\to$ Gain ($0.10$).
   - Wind updates modulate the volume:
     $$\text{Near Gain} = 0.05 + 0.04 \cdot \text{gust}$$
     $$\text{Far Gain} = 0.10 + 0.05 \cdot \text{gust}$$
2. **Thunder**:
   - White noise source modulated by a lowpass filter ($220\text{Hz} - 340\text{Hz}$).
   - Envelope: $0.4\text{s}$ attack, $0.6\text{s}$ hold, $2.2\text{s}$ decay. Peak gain is $0.22 - 0.32$.
3. **Footsteps**:
   - Short white noise burst modulated by a bandpass filter ($420\text{Hz} - 500\text{Hz}$, $Q = 0.8$).
   - Envelope: $0.002\text{s}$ attack, $0.02\text{s}$ hold, $0.09\text{s}$ decay. Peak gain is $0.09$.
4. **Water Splashes**:
   - White noise burst with a sweep bandpass filter. Frequency sweeps exponentially from $1200\text{Hz}$ down to $300\text{Hz}$ over $0.25\text{s}$ ($Q = 0.6$).
   - Envelope: $0.005\text{s}$ attack, $0.03\text{s}$ hold, $0.22\text{s}$ decay. Peak gain is $0.14$.
5. **Jumping**:
   - Sine wave oscillator sweeping exponentially from $260\text{Hz}$ up to $340\text{Hz}$ over $0.12\text{s}$.
   - Envelope: $0.01\text{s}$ attack, $0.05\text{s}$ hold, $0.12\text{s}$ decay. Peak gain is $0.06$.
6. **Umbrella Swish**:
   - White noise burst through a bandpass filter ($900\text{Hz}$, $Q = 0.5$).
   - Envelope: $0.02\text{s}$ attack, $0.03\text{s}$ hold, $0.16\text{s}$ decay. Peak gain is $0.035$.
7. **UI Taps**:
   - Constant $520\text{Hz}$ sine wave.
   - Envelope: $0.002\text{s}$ attack, $0.02\text{s}$ hold, $0.09\text{s}$ decay. Peak gain is $0.05$.

---

## 8. Canvas Render Pipelines (`render.js` & `rain.js`)
Drawing uses relative scaling on a 2D Canvas context. Render calls are ordered from back to front:

### The Drawing Layers
1. **Sky**: Vertically aligned linear gradient from `#3d4759` (top) to `#7d8794` (bottom).
2. **Lightning Flash**: Fullscreen rectangle of color `#eef2f6` with opacity scaling based on decay ($0.4 \cdot \text{lightningFlash}$).
3. **Mountains (Far Backdrop)**:
   - Parallax scaling factor: $0.15$.
   - Draws a solid block filled with `#4b566b` at $0.55$ opacity. The peak profile is shaped by:
     $$y = \text{baseY} - 34 - \sin(0.01 \cdot x_{\text{world}}) \cdot 22 - \sin(0.023 \cdot x_{\text{world}} + 2) \cdot 12$$
4. **Fog Layers**:
   - *Far Fog*: Rect filled with `#949dab` at $y = 0.28 \cdot h$ with height $0.18 \cdot h$, opacity $0.35 + 0.25 \cdot \text{boost}$.
   - *Near Fog*: Rect filled with `#b4bbc4` at $y = 0.5 \cdot h$ with height $0.14 \cdot h$, opacity $0.22 + 0.2 \cdot \text{boost}$.
5. **Background Rain (`bg`)**:
   - Density: $90$ drops. Parallax factor: $0.12$. Length: $6\text{--}11\text{px}$. Width: $1\text{px}$. Speed: $340\text{px/s}$. Opacity: $0.22$. Color: `#7d8591`.
6. **Guardrails**:
   - Posts drawn at $46\text{px}$ intervals. Connects adjacent posts with lines $12\text{px}$ above their bases. Color: `#24272f` at $0.55$ opacity.
7. **Roadway Surface**:
   - Renders a polygon representing the road thickness ($64\text{px}$). Top edge is at $y = \text{roadY} - 30$, bottom edge is at $y = \text{roadY} + 34$.
   - Dashed line: drawn along the center of the road ($y = \text{roadY}$) using dash array `[18, 22]`, width $3\text{px}$, color `#8b93a0` at $0.5$ opacity.
8. **Electrical Utility Poles & Wires**:
   - Poles drawn at $340\text{px}$ intervals. Ground position is at $y = \text{roadY} - 26$, extending $92\text{px}$ high.
   - Wires: Quadratic curves connecting poles, with sag: $\text{sag} = 14 + \sin(0.6 \cdot t + i) \cdot 1.5$.
9. **Water Puddles**:
   - Flat ellipse scaling ($y$-scale $0.28$) colored `#5f6b7a` ($0.5$ opacity).
   - Draws expanding ripple ring: radius starts at $0$ and grows to $80\%$ of puddle width, based on $\text{ringT} = (0.5 \cdot t + \text{seed} \cdot 10) \pmod{1.4}$.
10. **Scenery Elements (Houses, Trees, Bushes)**:
    - *House*: `#dcd6c8` wall rect ($74 \times 58$), `#4a505c` roof triangle, and `#f0d9a3` window rects.
    - *Tree*: `#24272f` trunk ($6 \times 30$) and `#6d8177` foliage circle ($r = 22$) swayed by wind.
    - *Bush*: Three overlapping circles of `#546156` ($r = 12, 14, 10$).
11. **Vehicles**:
    - `#24272f` body ($46 \times 20$), roof rect ($26 \times 10$), and `#f0d9a3` window. Spinning wheels ($r = 5$) with spoke lines.
12. **Midground Rain (`mid`)**:
    - Density: $180$ drops. Parallax factor: $0.04$. Length: $10\text{--}16\text{px}$. Width: $1.4\text{px}$. Speed: $520\text{px/s}$. Opacity: $0.42$. Color: `#4a505c`.
13. **Player Figure**:
    - Drawn as a detailed flat-shaded silhouette:
      - *Legs*: Two lines of thickness $4\text{px}$ swinging out-of-phase:
        $$\text{leftLegEnd} = -3 + 0.3 \cdot \text{legSwing}$$
        $$\text{rightLegEnd} = 3 - 0.3 \cdot \text{legSwing}$$
      - *Shoes*: `#e6e8ec` ellipses ($4 \times 2.2$) at the base of each leg.
      - *Skirt*: Pleated `#4a505c` trapezoid swaying with walk.
      - *Blouse*: `#e6e8ec` round-rect torso ($24 \times 24$, corner radius $7$) with a dark sailor collar neck line.
      - *Head*: `#e4d8cc` circle ($r = 8.5$).
      - *Hair*: Straight `#1b1d22` silhouette dangling behind, swaying with wind and speed.
      - *Umbrella*: Charcoal shaft ($3\text{px}$ thick, length $58\text{px}$) tipped with a white canopy arc of radius $21\text{px}$.
14. **Splash Particles**:
    - Circular dots of `#e6e8ec` with alpha decaying over particle life ($1 - \frac{\text{life}}{\text{maxLife}}$).
15. **Foreground Rain (`fg`)**:
    - Density: $70$ drops. Parallax factor: $0.02$. Length: $16\text{--}26\text{px}$. Width: $2.1\text{px}$. Speed: $760\text{px/s}$. Opacity: $0.65$. Color: `#24272f`.

---

## 9. Comprehensive Step-by-Step Recreation Plan

To recreate this game from scratch, implement components in this sequence:

- **[ ] Phase 1: Setup HTML, CSS, and Namespace Initialization**
  - Create `index.html` structure with stage, state-based UI panels (Title, HUD, Pause, Game Over), and mobile touch nodes.
  - Implement `style.css` variables, layout rules, state transitions, visual filters (blurring canvas on title/end), and keyframe animations.
  - Create `js/utils.js` defining `ER.Util` namespace holding `lerp`, `clamp`, `damp`, Mulberry32 deterministic generator, and the muted dusk color palette `ER.Palette`.
  - Create `js/main.js` to handle `DOMContentLoaded` bootloader and instantiate the game container.

- **[ ] Phase 2: Core Loop & State Management**
  - Create `js/game.js` with the game class `ER.Game` establishing the canvas context, scale resolution factor (DPR), and the fixed-timestep loop (`_fixedDt = 1/120`).
  - Wire state variables (`state = 'title' | 'playing' | 'ended'`) and map user interactions (clicks, window resize events, visibility changes).
  - Create `js/ui.js` managing element references, visibility updates, full-screen toggle, mute states, and score text updates.

- **[ ] Phase 3: Controller Inputs & Wind System**
  - Create `js/input.js` to capture WASD/Arrow keys and handle mouse/touch inputs.
  - Create `js/wind.js` simulating the multi-second wind direction changes (7 angular states) and updating the wind vector.

- **[ ] Phase 4: Street Elevation & Player Physics**
  - Create `js/road.js` with the procedural sine-wave elevation formula.
  - Create `js/player.js` incorporating speed ($118\text{ units/s}$), walking animations (vertical bob, leg swing), and the sine-based floaty jump arc duration ($0.42\text{s}$).

- **[ ] Phase 5: Camera Follow & Scenery Chunking**
  - Create `js/camera.js` applying horizontal ($35\%$ offset follow) and vertical (smooth hill compensation) camera damping.
  - Create `js/world.js` dividing the infinite scenery into $900$-unit wide chunks, generating deterministic decoration arrays and puddle lists based on chunk seeds.

- **[ ] Phase 6: Puddles, Cars, and Environment**
  - Create `js/puddles.js` checking if the player is jumping when passing through a puddle's range.
  - Create `js/vehicles.js` spawning cars that move across the screen and splash puddles.
  - Create `js/ambient.js` simulating weather changes (lightning strikes and fog pulses).

- **[ ] Phase 7: Rain Layers & Collision Testing**
  - Create `js/umbrella.js` containing the point-in-umbrella collision test `shields(dx, dy)` (shaft box and canopy dome checks).
  - Create `js/collision.js` resolving raindrop collisions against the player's bounding box and the umbrella shield.
  - Create `js/rain.js` modeling three parallax-separated arrays of rain particles and a ground splash particle generator.

- **[ ] Phase 8: Drawing System**
  - Create `js/render.js` implementing drawing methods for the sky gradient, mountains, fog blocks, guardrails, utility poles with hanging wires, ground ripples, trees/houses, vehicles, and the detailed sailor-blouse player silhouette.
  - Connect all update and render stages to the game loop.

- **[ ] Phase 9: Audio Synthesizer Integration**
  - Create `js/audio.js` using the Web Audio API to synthesize audio (rain bed, footstep ticks, sweeps for splashes/jumps, lowpass noise for thunder).
  - Trigger audio feedback on player moves, state transitions, and environmental events.
