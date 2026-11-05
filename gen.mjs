// Prints the map as an SVG file on stdout. make writes it to land.svg, which index.html loads
// with <img src="land.svg">.
//
// Source: Natural Earth land, 1:110m scale (public domain), from the npm package world-atlas.
// For sharper coastlines use land-50m.json below; the output is several times larger.
//
// Coordinates: x = longitude + 180 and y = 90 - latitude, so the viewBox is 0 0 360 180 and one
// unit is one degree. The night shading, the midnight line and the city pins in index.html use
// the same space, which is why everything lines up. The "preserveAspectRatio" below lets the map
// stretch to whatever size the page gives it.
import fs from 'fs';
import {feature} from 'topojson-client';

const topo = JSON.parse(fs.readFileSync('node_modules/world-atlas/land-110m.json', 'utf8'));
const land = feature(topo, topo.objects.land);
const r = v => Math.round(v * 10) / 10;                       // 0.1 degree precision
const path = pts => 'M' + pts.map(([x, y]) => r(x) + ' ' + r(y)).join(' ') + 'Z';

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
for (let x = 30; x < 360; x += 30) lines.push(`${x} 0V180`);
for (let y = 30; y < 180; y += 30) lines.push(`0 ${y}H360`);

console.log(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 180" preserveAspectRatio="none">
<path d="M${lines.join('M')}" fill="none" stroke="#16222e" stroke-opacity=".07" stroke-width=".25"/>
<path d="${d}" fill="#e4eaee" stroke="#9db5c8" stroke-width=".2" stroke-linejoin="round"/>
</svg>`);
