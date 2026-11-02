// Builds an animated SVG line graph of the last 31 days of GitHub contributions.
// Usage: GITHUB_TOKEN=... USERNAME=... node activity-graph.mjs <output.svg>

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DAYS = 31;

const COLORS = {
  bg: "#0D1117",
  title: "#00C7B7",
  line: "#00C7B7",
  point: "#FFFFFF",
  text: "#C9D1D9",
  grid: "#21262D",
};

async function fetchDays(username, token) {
  const query = `query($login: String!) {
    user(login: $login) {
      name
      contributionsCollection {
        contributionCalendar {
          weeks { contributionDays { date contributionCount } }
        }
      }
    }
  }`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { login: username } }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) {
    throw new Error(`GitHub API error: ${res.status} ${JSON.stringify(json.errors ?? json)}`);
  }
  const user = json.data.user;
  const days = user.contributionsCollection.contributionCalendar.weeks
    .flatMap((w) => w.contributionDays)
    .map((d) => ({ date: d.date, count: d.contributionCount }));
  return { name: user.name || username, days: days.slice(-DAYS) };
}

function niceMax(value) {
  // Round up to a multiple of 4 so the 4 grid steps are whole numbers.
  return Math.max(4, Math.ceil(value / 4) * 4);
}

function escapeXml(s) {
  return s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function renderSvg(name, days) {
  const W = 1200, H = 420;
  const pad = { top: 80, right: 40, bottom: 60, left: 80 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const max = niceMax(Math.max(...days.map((d) => d.count)));
  const x = (i) => pad.left + (i * plotW) / (days.length - 1);
  const y = (v) => pad.top + plotH - (v / max) * plotH;

  const points = days.map((d, i) => [x(i), y(d.count)]);
  const line = points.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const area = `${line} L${x(days.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;

  const grid = [0, 1, 2, 3, 4].map((i) => {
    const v = (max / 4) * i;
    const gy = y(v).toFixed(1);
    return `<line x1="${pad.left}" y1="${gy}" x2="${W - pad.right}" y2="${gy}" stroke="${COLORS.grid}" />
    <text x="${pad.left - 14}" y="${gy}" class="label" text-anchor="end" dominant-baseline="middle">${v}</text>`;
  }).join("\n    ");

  const xLabels = days.map((d, i) =>
    `<text x="${x(i).toFixed(1)}" y="${H - pad.bottom + 24}" class="label" text-anchor="middle">${Number(d.date.slice(8))}</text>`
  ).join("\n    ");

  const dots = points.map(([px, py], i) =>
    `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3.5" class="dot" style="animation-delay:${(0.4 + (i / days.length) * 1.6).toFixed(2)}s"><title>${days[i].date}: ${days[i].count} contributions</title></circle>`
  ).join("\n    ");

  const total = days.reduce((sum, d) => sum + d.count, 0);
  const range = `${days[0].date} → ${days[days.length - 1].date}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <style>
    text { font-family: "Segoe UI", Ubuntu, "Helvetica Neue", Arial, sans-serif; }
    .title { fill: ${COLORS.title}; font-size: 22px; font-weight: 600; }
    .sub { fill: ${COLORS.text}; font-size: 13px; opacity: 0.8; }
    .label { fill: ${COLORS.text}; font-size: 12px; }
    .line { fill: none; stroke: ${COLORS.line}; stroke-width: 3; stroke-linejoin: round; stroke-linecap: round;
            stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw 2s ease-out forwards; }
    .area { opacity: 0; animation: fade 1s ease-out 1.2s forwards; }
    .dot { fill: ${COLORS.point}; stroke: ${COLORS.line}; stroke-width: 2; opacity: 0; animation: fade 0.3s ease-out forwards; }
    @keyframes draw { to { stroke-dashoffset: 0; } }
    @keyframes fade { to { opacity: 1; } }
    @media (prefers-reduced-motion: reduce) {
      .line { animation: none; stroke-dashoffset: 0; }
      .area, .dot { animation: none; opacity: 1; }
    }
  </style>
  <defs>
    <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${COLORS.line}" stop-opacity="0.35" />
      <stop offset="100%" stop-color="${COLORS.line}" stop-opacity="0" />
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" rx="8" fill="${COLORS.bg}" />
  <text x="${W / 2}" y="38" class="title" text-anchor="middle">${escapeXml(name)}'s Contribution Graph</text>
  <text x="${W / 2}" y="60" class="sub" text-anchor="middle">${total} contributions in the last ${days.length} days · ${range}</text>
  <g>
    ${grid}
  </g>
  <g>
    ${xLabels}
  </g>
  <path d="${area}" fill="url(#fill)" class="area" />
  <path d="${line}" class="line" pathLength="1" />
  <g>
    ${dots}
  </g>
</svg>
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = process.argv[2] || "dist/activity-graph.svg";
  const { USERNAME, GITHUB_TOKEN } = process.env;
  if (!USERNAME || !GITHUB_TOKEN) throw new Error("USERNAME and GITHUB_TOKEN must be set");
  const { name, days } = await fetchDays(USERNAME, GITHUB_TOKEN);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, renderSvg(name, days));
  console.log(`Wrote ${out} (${days.length} days)`);
}
