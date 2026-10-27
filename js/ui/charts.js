// Dependency-free SVG charts. Colours come from CSS classes so dark mode works.

import { h, s } from './dom.js';
import { formatNumber } from '../i18n.js';

const defaultHeight = (width, ratio = 0.42) => Math.round(Math.min(300, Math.max(200, width * ratio)));

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, Math.max(1, max - 1))}…` : text;
}

export function niceMax(value) {
  if (value <= 0) return 4;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const f = value / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * exp;
}

function axisAndGrid({ width, height, margin, max, ticks = 4 }) {
  const nodes = [];
  const innerH = height - margin.top - margin.bottom;
  for (let i = 0; i <= ticks; i++) {
    const value = (max / ticks) * i;
    const y = margin.top + innerH - (innerH * i) / ticks;
    nodes.push(
      s('line', { x1: margin.left, x2: width - margin.right, y1: y, y2: y, class: i === 0 ? 'chart-axis' : 'chart-grid' }),
      s('text', { x: margin.left - 8, y: y + 4, class: 'chart-tick', 'text-anchor': 'end' }, formatNumber(Math.round(value * 10) / 10)),
    );
  }
  return nodes;
}

/** Grouped vertical bars. categories: [{ label, values: number[] }], series: [{ name, cls }] */
export function groupedBarChart({ categories, series, ariaLabel, width = 640, height = defaultHeight(width) }) {
  const margin = { top: 12, right: 12, bottom: 44, left: 40 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const max = niceMax(Math.max(0, ...categories.flatMap((c) => c.values)));
  const groupW = innerW / Math.max(1, categories.length);
  const barW = Math.min(28, (groupW * 0.7) / series.length);
  const svg = s('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chart', role: 'img', 'aria-label': ariaLabel, preserveAspectRatio: 'xMidYMid meet' });
  svg.append(...axisAndGrid({ width, height, margin, max }));
  categories.forEach((cat, i) => {
    const gx = margin.left + groupW * i + groupW / 2 - (barW * series.length) / 2;
    cat.values.forEach((value, k) => {
      const bh = (innerH * value) / max;
      svg.append(
        s(
          'rect',
          { x: gx + k * barW, y: margin.top + innerH - bh, width: barW - 2, height: Math.max(bh, value > 0 ? 1 : 0), rx: 3, class: series[k].cls },
          s('title', {}, `${cat.label} – ${series[k].name}: ${formatNumber(value)}`),
        ),
      );
    });
    svg.append(
      s('text', { x: margin.left + groupW * i + groupW / 2, y: height - margin.bottom + 18, class: 'chart-label', 'text-anchor': 'middle' }, truncate(cat.label, Math.floor(groupW / 6.4))),
    );
  });
  return svg;
}

/** Single-series columns. data: [{ label, value }] */
export function columnChart({ data, cls, ariaLabel, unitLabel, width = 640, height = defaultHeight(width, 0.36), labelEvery = width < 420 ? 3 : 2 }) {
  const margin = { top: 12, right: 12, bottom: 32, left: 36 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const slot = innerW / data.length;
  const barW = slot * 0.62;
  const svg = s('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chart', role: 'img', 'aria-label': ariaLabel, preserveAspectRatio: 'xMidYMid meet' });
  svg.append(...axisAndGrid({ width, height, margin, max }));
  data.forEach((d, i) => {
    const bh = (innerH * d.value) / max;
    const x = margin.left + slot * i + (slot - barW) / 2;
    svg.append(
      s('rect', { x, y: margin.top + innerH - bh, width: barW, height: Math.max(bh, d.value > 0 ? 1 : 0), rx: 3, class: cls }, s('title', {}, `${d.label}: ${formatNumber(d.value)} ${unitLabel || ''}`.trim())),
    );
    if (i % labelEvery === (data.length - 1) % labelEvery) {
      svg.append(s('text', { x: x + barW / 2, y: height - margin.bottom + 18, class: 'chart-label', 'text-anchor': 'middle' }, d.label));
    }
  });
  return svg;
}

/** Donut chart. segments: [{ label, value, cls }] */
export function donutChart({ segments, centerValue, centerLabel, ariaLabel, size = 200 }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((sum, seg) => sum + seg.value, 0);
  const svg = s('svg', { viewBox: `0 0 ${size} ${size}`, class: 'chart chart-donut', role: 'img', 'aria-label': ariaLabel });
  svg.append(s('circle', { cx: 100, cy: 100, r, fill: 'none', 'stroke-width': 26, class: 'donut-track' }));
  let offset = 0;
  if (total > 0) {
    for (const seg of segments) {
      if (seg.value <= 0) continue;
      const len = (seg.value / total) * c;
      svg.append(
        s(
          'circle',
          {
            cx: 100,
            cy: 100,
            r,
            fill: 'none',
            'stroke-width': 26,
            class: seg.cls,
            'stroke-dasharray': `${len} ${c - len}`,
            'stroke-dashoffset': -offset,
            transform: 'rotate(-90 100 100)',
          },
          s('title', {}, `${seg.label}: ${formatNumber(seg.value)}`),
        ),
      );
      offset += len;
    }
  }
  svg.append(
    s('text', { x: 100, y: 104, class: 'donut-value', 'text-anchor': 'middle' }, centerValue),
    s('text', { x: 100, y: 124, class: 'donut-label', 'text-anchor': 'middle' }, centerLabel),
  );
  return svg;
}

/** Renders a chart at the width of holder and re-renders when that width changes. Returns a disposer. */
export function fitChart(holder, build) {
  const render = () => holder.replaceChildren(build(Math.max(260, Math.floor(holder.clientWidth || 600))));
  render();
  let last = holder.clientWidth;
  const observer = new ResizeObserver(() => {
    if (Math.abs(holder.clientWidth - last) > 8) {
      last = holder.clientWidth;
      render();
    }
  });
  observer.observe(holder);
  return () => observer.disconnect();
}

export function legend(items) {
  return h(
    'ul',
    { class: 'legend' },
    items.map((item) => h('li', {}, h('span', { class: `legend-swatch ${item.cls}`, 'aria-hidden': 'true' }), h('span', {}, item.label), item.value !== undefined ? h('strong', {}, formatNumber(item.value)) : null)),
  );
}
