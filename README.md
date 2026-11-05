# World clock

A world map showing the current time in 15 cities, with a day/night shading and a draggable "midnight line".
Static page: no framework, no bundler, no dependencies at runtime. Light mode only. Open `index.html`.

| File | What |
|---|---|
| `index.html` | The whole app, edited by hand: HTML, CSS and JS in one file. |
| `land.svg` | The map. Generated, and loaded with `<img src="land.svg" alt="">`. Must sit next to `index.html`. |
| `gen.mjs`, `Makefile` | Build the map: `make` runs `npm i world-atlas@2 topojson-client@3`, then `node gen.mjs > land.svg`. Only the map needs a build step. |

## Principles
- Simple, lightweight, intentional. Native browser features only (`Intl`, `<input type="date">`, pointer events, SVG). No redundancy.
- Light colours: ink `#16222e`, sun `#e8890c`, moon `#3d5fd0`. Land `#e4eaee`, slightly darker than the label cards so it reads against them.
- Easter egg for the curious: the midnight line is built from approximate time zone boundaries (below).

## The map
- One coordinate space everywhere: `x = longitude + 180`, `y = 90 - latitude`, `viewBox="0 0 360 180"`, `preserveAspectRatio="none"`. The map, night polygon, midnight line and pins (positioned by percentage) all line up.
- `gen.mjs`: Natural Earth land 1:110m from the `world-atlas` package. Antarctica dropped, longitudes unwrapped across the antimeridian with copies shifted by ±360 (otherwise coastlines draw horizontal strips), 0.1° precision, a faint grid every 30°. The file header explains how to change the source.
- The map has `min-width: 700px` and scrolls horizontally on narrow screens.

## Cities
- `CITIES` in `index.html`: name, IANA time zone, lat, lon, and `label` (the side of the dot the text sits on: r/l/t/b). Edit the list to change cities. Sides were chosen by a search so no labels, dots, date pills or knob overlap at any time of day or width.
- Dot colour: orange when the sun is above that city's horizon, blue otherwise. This is computed from the sun's position, not from a time range.
- Each label has two lines: name above, time below (monospace, `06:19 AM`). Labels grow slightly on hover (scale 1.15).

## Day and night
- Sun position from day-of-year declination and the equation of time. The night region is a single polygon (the terminator closed through the dark pole), 30% opacity. Smooth bands were tried and dropped as unnecessary complexity.

## Time model
- A single state: `fixed` (`null` = live, otherwise a frozen instant). `render()` updates everything from `now()`. While live, a once-a-second check redraws everything only when the minute changes (the map is the costly part to repaint, especially on phones). Any edit redraws at once. Reload returns to live (there is no "Now" button).
- **Everything is editable.** Any edit sets `fixed`, and all other times, dates and the line follow.
  - City time: a text field (`6:19 pm`, `18:19`, `619p`, `3.30pm` all parse). Enter or blur commits, invalid input reverts. It picks the moment closest to the shown time, so 11:58 PM to 12:10 AM moves forward 12 minutes. Wall time to instant uses a two-pass zone-offset conversion (DST-aware). A native time input was dropped because its spacing can't be styled.
  - Dates: plain-text pills with a transparent native `<input type="date">` over them (opens the picker). Range 1970 to 2100.
  - Drag the midnight line: a map width is 24 hours, rounded to minutes.
- Dates: the left pill is the date just before midnight, the right pill the date just after (UTC date of `t - 12h` and `t + 12h`). There is no international date line, no UTC label or ruler, and no separate time card. A pill hides when there is no room beside the line.

## Dragging versus scrolling
- The line itself ignores the pointer. Only a 25px strip (`#grab`, `touch-action: pan-y`, `role="slider"`) is draggable, with a visible `‹ ›` knob. So a horizontal drag moves time, but vertical scrolling and scrolling the map elsewhere still work.
- Keyboard: Left/Right move 15 minutes (Shift: 1 hour). Keyboard focus shows as a ring on the knob, not the tall strip.

## The midnight line
Rule: **the line must never contradict the clocks on the map.** A city left of the line shows the earlier date, a city right of it the later date, and the line passes exactly through a city's dot at its 12:00 AM. It moves left at 15° per hour. Its position when plain is the true meridian (`x0 = 360 * (1 - ((UTC hours - 12) / 24 mod 1))`, so at exactly 12:00 UTC it is on the right edge, where the dates change).

It is built from approximate time zone boundaries (`midnightLine` in `index.html`):
1. **Meridian lines**: one plain meridian per clock offset, `x = 180 + 15 * offset`, offsets -12 to 12.
2. **City lines**: for each clock offset that has cities (offset from the browser's timezone database, so DST is respected), connect its meridian at the north pole, each of its cities, an anchor on its meridian at 57°S (below all land, so the line is straight where the knob sits), and its meridian at the south pole. Drawn as a monotone cubic (Fritsch-Carlson): passes through every point, never overshoots, so city lines stay within their points' range.
3. **Delete meridian lines** touched by any city line (including a zone's own, which its city line replaces), or within `NEAR = 3°` of any city (otherwise the line lingers beside the dot).
4. What remains (city lines and surviving meridian lines) are the boundaries. They never cross. At the top of each hour the midnight line is exactly one boundary. Between hours it blends the two neighbouring boundaries by time, so its shape changes as it travels and only bends where a city's boundary is passing.
5. The polyline is sampled at every degree of latitude plus each city's latitude, and drawn as an SVG `<polyline>` (`vector-effect: non-scaling-stroke`) plus copies shifted by ±360 for where it runs off an edge. It is drawn behind the city labels, with the knob above it.

Everything is recomputed on every render (about 0.3 ms), because offsets change with DST and with the date being shown.

## Help text
A collapsed `<details>` titled "See something wrong?" with four short paragraphs: device clock (everything starts from it), device timezone (not used), timezone database (built into the browser, may be out of date), and the midnight line (placed by longitude and bent around cities, so real borders differ slightly).

## Checks worth keeping
Sample every few minutes over several days and assert:
- Every city is on the correct side of the line (later date to the right, equal allowed only at its exact 12:00 AM).
- The line's step between samples is tiny beyond the meridian's own motion, including across 12:00 UTC.
- Neighbouring boundaries never cross, and below 57°S the line's x equals the knob's x.
- Behaviour: editing a city time or date updates everything, dragging 100px moves the line 100px, arrow keys move 15 minutes, the grab strip has `touch-action: pan-y`, and no page errors.
