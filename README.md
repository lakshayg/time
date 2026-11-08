# World clock

A world map showing the current time in cities around the world, with a day/night shading, a "midnight line", and hour rulers along the top and bottom. Drag the line or a ruler to change the time.
Static page: no framework, no bundler, no dependencies at runtime. Light mode only. Open `index.html`.

| File | What |
|---|---|
| `index.html` | The whole app, edited by hand: HTML, CSS and JS in one file. |
| `land.svg` | The map. Generated and not committed (it is in `.gitignore`), and loaded as the `.map` background (it is decoration, so it is not an `<img>`). Must sit next to `index.html`. |
| `gen.mjs` | Generates the map as SVG on stdout. |
| `package.json`, `package-lock.json` | Pin the two build-time packages (`world-atlas`, `topojson-client`) and define `npm run build`. Only the map needs a build step. |
| `.github/workflows/pages.yml` | Builds the map and deploys the site to GitHub Pages on every push to `main`. |

## Build and run
```sh
npm ci            # install the two build-time packages (once)
npm run build     # writes land.svg
```
Then open `index.html` in a browser, or serve the folder (`python3 -m http.server`). Without `land.svg` the page works but shows no map. Rebuild only when `gen.mjs` changes.

## Deploy
Pushing to `main` runs the workflow, which installs the packages, builds `land.svg`, removes `node_modules`, and publishes the repository root with GitHub Pages. One-time setup in the repo's Settings → Pages: set Source to "GitHub Actions", and set the custom domain there (a `CNAME` file is ignored by Actions deploys).

## Principles
- Simple, lightweight, intentional. Native browser features only (`Intl`, `<input type="date">`, pointer events, SVG). No redundancy.
- Light colours: ink `#16222e`, sun `#e8890c`, moon `#3d5fd0`. Land `#e4eaee`, slightly darker than the label cards so it reads against them.
- Easter egg for the curious: the midnight line is built from approximate time zone boundaries (below).

## The map
- One coordinate space everywhere: `x = longitude + 180`, `y = 90 - latitude`, `viewBox="0 0 360 180"`, `preserveAspectRatio="none"`. The map, night polygon, midnight line and pins (positioned by percentage) all line up.
- `gen.mjs`: Natural Earth land 1:110m from the `world-atlas` package. Antarctica dropped, longitudes unwrapped across the antimeridian with copies shifted by ±360 (otherwise coastlines draw horizontal strips), 0.1° precision, a faint grid every 30°. The file header explains how to change the source.
- The map has `min-width: 700px` and scrolls horizontally on narrow screens.

## Cities
- `CITIES` in `index.html`: name, IANA time zone, lat, lon, and `label` (the side of the dot the text sits on: r/l/t/b). Edit the list to change cities. Sides were chosen by a search so no labels, dots or date pills overlap at any time of day or width.
- Dot colour: orange when the sun is above that city's horizon, blue otherwise. This is computed from the sun's position, not from a time range.
- Each label has two lines: name above, time below (monospace, `06:19 AM`). Labels grow slightly on hover (scale 1.15).

## Day and night
- Sun position from day-of-year declination and the equation of time. The night region is a single polygon (the terminator closed through the dark pole), 30% opacity. Smooth bands were tried and dropped as unnecessary complexity.

## Time model
- A single state: `fixed` (`null` = live, otherwise a frozen instant). `render()` updates everything from `now()`. While live, a once-a-second check redraws everything only when the minute changes (the map is the costly part to repaint, especially on phones). Any edit redraws at once. Reload returns to live (there is no "Now" button). The hint beside the title says "Drag a ruler, or edit any time or date." while live and "Paused. Reload to go live again." once frozen.
- **Everything is editable.** Any edit sets `fixed`, and all other times, dates and the line follow.
  - City time: a text field (`6:19 pm`, `18:19`, `619p`, `3.30pm` all parse). Enter or blur commits, invalid input reverts. It picks the moment closest to the shown time, so 11:58 PM to 12:10 AM moves forward 12 minutes. Wall time to instant uses a two-pass zone-offset conversion (DST-aware). A native time input was dropped because its spacing can't be styled.
  - Dates: plain-text pills with a transparent native `<input type="date">` over them (opens the picker). Range 1970 to 2100.
  - Drag the midnight line, or either ruler (top or bottom): the line and the rulers move with the pointer, and a map width is 24 hours, rounded to minutes.
- Dates: the left pill is the date just before midnight, the right pill the date just after (the date at `t - 12h` and at `t + 12h`). There is no international date line, no UTC label, and no separate time card. The pills sit at the top edge, beside the straight part of the line. A pill hides when there is no room beside the line, and the ruler hours it was covering come back (see the ruler below).

## Dragging versus scrolling
- Three things take a drag, all marked `.drag` (`touch-action: none`, `user-select: none`, `-webkit-touch-callout: none`, `cursor: ew-resize`): a 25px strip centred on the midnight line, and the two ruler bands (36px tall along the top and bottom edge). Nothing else on the map takes the pointer, so a drag that starts on one of them moves time, and scrolling the page or the map from anywhere else still works. (A vertical swipe that starts on one of them does not scroll the page.) The date pills and the city times sit above them and keep their own clicks. There is no separate handle: the line and the rulers are the handles. The hint beside the title mentions only the rulers, and the line works as a bonus.
- The top ruler is the one slider for assistive tech (`role="slider"`, `tabindex="0"`); the others are the same control for the pointer only. Left/Right move 15 minutes (Shift: 1 hour). Keyboard focus shows as a ring around the top ruler.

## The midnight line
Rule: **the line must never contradict the clocks on the map.** A city left of the line shows the earlier date, a city right of it the later date, and the line passes exactly through a city's dot at its 12:00 AM. It moves left at 15° per hour. Its position when plain is the true meridian (`x0 = 360 * (1 - ((UTC hours - 12) / 24 mod 1))`, so at exactly 12:00 UTC it is on the right edge, where the dates change).

It is built from approximate time zone boundaries (`midnightLine` in `index.html`):
1. **Meridian lines**: one plain meridian per clock offset, `x = 180 + 15 * offset`, offsets -12 to 12.
2. **City lines**: for each clock offset that has cities (offset from the browser's timezone database, so DST is respected), connect its meridian at the north pole, an anchor on its meridian at 84°N (level with the date pills, so the line is straight beside them), each of its cities, an anchor on its meridian at 57°S (below all land, so the line is straight along the bottom ruler), and its meridian at the south pole. Between neighbouring points it eases along half a cosine wave, so the line runs parallel to the meridians at every city, anchor and pole, and never leaves the range of its points.
3. **Delete meridian lines** touched by any city line (including a zone's own, which its city line replaces), or within `NEAR = 3°` of any city (otherwise the line lingers beside the dot).
4. What remains (city lines and surviving meridian lines) are the boundaries. They never cross. At the top of each hour the midnight line is exactly one boundary. Between hours, at each latitude, the line's x is a linear blend of the two boundaries either side of the current moment. So it passes exactly through each boundary at its hour and never leaves the two, and its shape changes as it travels and only bends where a city's boundary is passing.
5. The polyline is sampled at every degree of latitude plus each city's latitude, and drawn as an SVG `<polyline>` (`vector-effect: non-scaling-stroke`) plus copies shifted by ±360 for where it runs off an edge. It is drawn behind the city labels.
6. **Hour ruler** along the top and bottom edges: a tick every 15° starting at the midnight line, one per hour, with the hour of the day written beside it (`12a`, `1a` ... `11p`, from midnight). Each hour is one `<span>` (created in JS, 24 in all) that serves both edges: its text is the top label, `::after` is the bottom label (from `data-h`), and two background gradients draw the two ticks. It is placed with CSS `left: mod(var(--x) + var(--i) * 100% / 24, 100%)`, where `--x` is the midnight line's position, set on `#hours` in `render()`. `mod()` wraps the hours round the map edge. The labels have a light halo so they read over land, sea and night; the ticks are plain dark lines. The ruler is plain meridians, which is exact where the midnight line runs straight along them (the top and bottom edges, because of the anchors); across the middle of the map a city far from its meridian can differ from the ruler by up to about an hour, and its own clock is the truth.
   - **Top edge, around the dates.** The date pills sit at the top beside the line, so there the top ruler leaves out 10p to 2a: 11p, 12a and 1a are hidden completely, and 10p and 2a keep their tick but lose the label. When a pill hides for lack of room, `render()` adds `noL` or `noR` to `#hours`, and the CSS brings back what that pill covered (10p and 11p for the left, 1a and 2a for the right, 12a only when both are hidden). The bottom ruler always shows all 24 hours.
   - Tried and dropped: a 9 AM to 5 PM highlight and full-height 9 AM and 5 PM lines (too cluttered), white boxes behind the labels, and white outlines on the ticks.

Everything is recomputed on every render (about 0.3 ms), because offsets change with DST and with the date being shown.

## Performance
Measured in headless Chrome, one `render()` per frame, as in a drag: about 5.5 ms of main-thread time per frame. The sums are cheap (the night polygon and the midnight line are about 0.2 ms each, the 20 clocks about 0.1 ms). The cost is in the browser: style, layout and paint.
- `--x` is set on `#hours`, not on `.map`. A custom property set on `.map` makes the browser recheck the styles of everything inside it, pins included, which cost about 1.3 ms a frame. `#mid` is placed with `left` instead.
- In `render()` the date pills come first. They are the only thing measured (`clientWidth`, `offsetWidth`), and measuring after other changes forces the browser to lay the page out in the middle of the render.
- Tried and left alone: `contain` on the ruler (no change), and a lighter label halo (saves about 0.8 ms a frame but changes how the labels look). `pointermove` is already once per frame in browsers, so dragging needs no `requestAnimationFrame` throttle.

## iOS Safari
The first version used `touch-action: pan-y` and did not stop selection. On iOS Safari the drag was janky unless the map had first been selected with a long press: Safari could not tell a scroll from a long press (loupe, selection) from a drag, and dropped the drag part way with a `pointercancel`. The drag areas now have `touch-action: none` (no native scroll to compete with) and no text selection or callout. `user-select: none` is on the drag areas only, not the map, because it can stop text fields working on iOS and the city times are editable.

## Help text
A collapsed `<details>` titled "See something wrong?" with four short paragraphs: device clock (everything starts from it), timezone database (built into the browser, may be out of date), the midnight line (placed by longitude and bent around cities, so real borders differ slightly), and a link to file an issue on the GitHub repo.

## Checks worth keeping
Sample every few minutes over several days and assert:
- Every city is on the correct side of the line (later date to the right, equal allowed only at its exact 12:00 AM).
- The line's step between samples is tiny beyond the meridian's own motion, including across 12:00 UTC.
- Neighbouring boundaries never cross, and below 57°S and above 84°N the line is straight along its meridian, so both rulers agree with the clocks at the edges, and every ruler tick is a whole number of hours from the midnight line (within a pixel or two of rounding).
- Behaviour: editing a city time or date updates everything, dragging the line or either ruler 100px moves the line 100px, dragging anywhere else on the map does nothing, arrow keys move 15 minutes, the three drag areas have `touch-action: none`, and no page errors.
