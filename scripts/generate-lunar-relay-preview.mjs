import { writeFileSync } from "node:fs";
import { LUNAR_RELAY_LAYOUT_BLOCKS, LUNAR_RELAY_STAIR_FLIGHTS } from "../packages/shared/dist/lunarRelayLayout.js";

// Keep the setup card's tactical plan tied to the actual playable geometry.
const cover = LUNAR_RELAY_LAYOUT_BLOCKS.map(block => {
  const bridge = block.id.includes("deck") || block.id.includes("crossing");
  return `<rect x="${block.x - block.w / 2}" y="${block.z - block.d / 2}" width="${block.w}" height="${block.d}" rx="1.5" fill="${bridge ? "#bacddd" : block.color}" stroke="${bridge ? "#85eed9" : "#8aa5c0"}" stroke-width="1.2"/>`;
}).join("\n");
const stairs = LUNAR_RELAY_STAIR_FLIGHTS.map(flight => {
  const horizontal = flight.axis === "x";
  return `<rect x="${flight.x - (horizontal ? flight.length : flight.width) / 2}" y="${flight.z - (horizontal ? flight.width : flight.length) / 2}" width="${horizontal ? flight.length : flight.width}" height="${horizontal ? flight.width : flight.length}" fill="url(#${horizontal ? "stepsX" : "stepsZ"})" stroke="#85eed9" stroke-width="1.5"/>`;
}).join("\n");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="-320 -225 640 450" role="img" aria-labelledby="title desc">
<title id="title">Lunar Relay tactical map</title><desc id="desc">Two shielded airlocks, the north observatory, a cross-shaped raised relay bridge with four stair approaches, and the south solar cargo court.</desc>
<defs><radialGradient id="space"><stop stop-color="#304a68"/><stop offset="1" stop-color="#0e1931"/></radialGradient>
<pattern id="stepsX" width="2.8" height="32" patternUnits="userSpaceOnUse"><rect width="2.8" height="32" fill="#9aafc5"/><path d="M0 0V32" stroke="#405d76" stroke-width=".8"/></pattern>
<pattern id="stepsZ" width="28" height="2.8" patternUnits="userSpaceOnUse"><rect width="28" height="2.8" fill="#9aafc5"/><path d="M0 0H28" stroke="#405d76" stroke-width=".8"/></pattern></defs>
<rect x="-320" y="-225" width="640" height="450" rx="20" fill="url(#space)"/>
<g fill="#c0d2ea" opacity=".6"><circle cx="-270" cy="-172" r="1"/><circle cx="273" cy="-125" r="1.6"/><circle cx="-286" cy="133" r="1.4"/><circle cx="281" cy="88" r="1"/><circle cx="230" cy="-202" r="1.2"/></g>
<rect x="-240" y="-180" width="480" height="360" rx="8" fill="#687c96" stroke="#aac2d6" stroke-width="2"/>
<g fill="none" stroke="#8298ae" stroke-width="1" opacity=".6"><path d="M-170-60H170M-170 94H170M-154-154V154M154-154V154"/></g>
<rect x="-232" y="-152" width="52" height="304" fill="#5b98bc" opacity=".45"/>
<rect x="180" y="-152" width="52" height="304" fill="#b47481" opacity=".5"/>
${cover}
${stairs}
<g fill="none" stroke="#85eed9" stroke-width="2.5"><circle cx="0" cy="0" r="12"/><circle cx="0" cy="-121" r="18"/><circle cx="0" cy="112" r="20"/></g>
<g font-family="Arial,sans-serif" text-anchor="middle" font-size="9" font-weight="700" letter-spacing="1.5" fill="#e2edf5">
<text x="0" y="-159">OBSERVATORY</text><text x="0" y="-40">RELAY BRIDGE</text><text x="0" y="145">SOLAR COURT</text>
<text x="-206" y="165" fill="#c2e8ff">BLUE</text><text x="206" y="165" fill="#ffd3ce">RED</text></g>
<g fill="#e0edf9">${[-120, -40, 40, 120].flatMap(z => [-206, 206].map(x => `<circle cx="${x}" cy="${z}" r="3"/>`)).join("")}</g>
<text x="0" y="211" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="700" letter-spacing="5" fill="#85eed9">LUNAR RELAY</text>
</svg>`;
writeFileSync(new URL("../apps/web/public/assets/arena-maps/lunar-relay.svg", import.meta.url), svg);
