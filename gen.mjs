// Prints the map as an SVG file on stdout. npm run build writes it to land.svg, which index.html
// loads as the background of the map.
//
// Source: Natural Earth land, 1:110m scale (public domain), from the npm package world-atlas.
// For sharper coastlines use land-50m.json below; the output is several times larger.
//
// Coordinates: x = longitude + 180 and y = 90 - latitude, in tenths of a degree, so the viewBox is
// 0 0 3600 1800. The night shading, the midnight line and the city pins in index.html use the same
// space in whole degrees, which is why everything lines up. The "preserveAspectRatio" below lets
// the map stretch to whatever size the page gives it.
//
// The file is the biggest thing the page downloads, so it is kept small: whole numbers only (no
// decimal points), and each point is written as its step from the previous one, which is a short
// number. Rounding to 0.1 degree is the same as before, so the picture is identical.
import fs from 'fs';
import {feature} from 'topojson-client';

const topo = JSON.parse(fs.readFileSync('node_modules/world-atlas/land-110m.json', 'utf8'));
const land = feature(topo, topo.objects.land);
// A ring as an SVG path: its first point, then the steps from each point to the next.
function path(pts) {
  pts = pts.map(([x, y]) => [Math.round(x * 10), Math.round(y * 10)])
           .filter(([x, y], i, a) => i === 0 || x !== a[i - 1][0] || y !== a[i - 1][1]);   // drop repeats
  if (pts.length > 1 && pts.at(-1).join() === pts[0].join()) pts.pop();                      // z closes it
  return 'M' + pts[0].join(' ') + 'l' + pts.slice(1).map(([x, y], i) => `${x - pts[i][0]} ${y - pts[i][1]}`).join(' ') + 'z';
}

let d = '';
for (const f of (land.features || [land]))
  for (const poly of f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates)
    for (const ring of poly) {
      if (ring.every(([, lat]) => lat < -60)) continue;       // drop Antarctica
      // Unwrap longitudes so rings crossing 180 degrees stay continuous.
      let prev = null;
      const pts = ring.map(([lon, lat]) => {
        let x = lon + 180;
        if (prev !== null) x += 360 * Math.round((prev - x) / 360);
        prev = x;
        return [x, 90 - lat];
      });
      const xs = pts.map(p => p[0]);
      d += path(pts);
      // Also draw copies shifted by 360 so shapes wrap around the map edge.
      if (Math.max(...xs) > 360) d += path(pts.map(([x, y]) => [x - 360, y]));
      if (Math.min(...xs) < 0) d += path(pts.map(([x, y]) => [x + 360, y]));
    }

// A line every 30 degrees.
const lines = [];
for (let x = 30; x < 360; x += 30) lines.push(`${x * 10} 0V1800`);
for (let y = 30; y < 180; y += 30) lines.push(`0 ${y * 10}H3600`);

console.log(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3600 1800" preserveAspectRatio="none">
<path d="M${lines.join('M')}" fill="none" stroke="#16222e" stroke-opacity=".07" stroke-width="2.5"/>
<path d="${d}" fill="#e4eaee" stroke="#9db5c8" stroke-width="2" stroke-linejoin="round"/>
</svg>`);
