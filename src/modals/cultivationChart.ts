/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as d3 from 'd3';
import {
  CultivationChartMode,
  CultivationHistorySnapshot,
  CultivationPath,
} from '../types/cultivation';
import {
  CULTIVATION_PATHS_REALMS,
  CULTIVATION_PATH_LIST,
  CULTIVATION_PATH_META,
  CULTIVATION_REALMS,
} from '../game/cultivationMath';

export const PATH_CHART_COLORS: Record<CultivationPath, string> = {
  qi: '#fbbf24', // Amber Gold
  body: '#f43f5e', // Crimson Rose
  soul: '#38bdf8', // Astral Cyan
  mind: '#c084fc', // Dao Purple
};

export interface RenderCultivationD3ChartParams {
  container: HTMLElement;
  history: CultivationHistorySnapshot[];
  mode: CultivationChartMode;
  visiblePaths?: Record<CultivationPath, boolean>;
}

/**
 * Uses D3.js to render an interactive multi-series area + line chart and path progression
 * comparison bars inside the Cultivation Modal Window.
 */
export function renderCultivationGrowthD3Chart(params: RenderCultivationD3ChartParams): void {
  const {
    container,
    history,
    mode,
    visiblePaths = { qi: true, body: true, soul: true, mind: true },
  } = params;

  // Clear previous chart contents
  const rootSel = d3.select(container);
  rootSel.selectAll('*').remove();

  if (!history || history.length === 0) {
    rootSel
      .append('div')
      .style('padding', '24px')
      .style('text-align', 'center')
      .style('color', '#94a3b8')
      .text('No cultivation history recorded yet.');
    return;
  }

  const width = Math.max(540, container.clientWidth || 720);
  const height = 250;
  const margin = { top: 22, right: 118, bottom: 38, left: 56 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Tooltip container positioned relative to container
  const tooltip = rootSel
    .append('div')
    .attr('data-testid', 'cultivation-chart-tooltip')
    .style('position', 'absolute')
    .style('pointer-events', 'none')
    .style('opacity', '0')
    .style('background', 'rgba(2, 6, 23, 0.96)')
    .style('border', '1px solid rgba(251, 191, 36, 0.55)')
    .style('border-radius', '10px')
    .style('padding', '8px 11px')
    .style('font-size', '0.74rem')
    .style('color', '#f8fafc')
    .style('box-shadow', '0 12px 28px rgba(0, 0, 0, 0.85)')
    .style('z-index', '30')
    .style('transition', 'opacity 120ms ease');

  const svg = rootSel
    .append('svg')
    .attr('data-testid', 'cultivation-d3-svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', '100%')
    .attr('height', height)
    .style('display', 'block')
    .style('overflow', 'visible');

  const defs = svg.append('defs');

  // Create linear vertical area gradients for each Cultivation Path
  CULTIVATION_PATH_LIST.forEach((path) => {
    const grad = defs
      .append('linearGradient')
      .attr('id', `d3-cult-grad-${path}`)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    grad
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', PATH_CHART_COLORS[path])
      .attr('stop-opacity', 0.26);

    grad
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', PATH_CHART_COLORS[path])
      .attr('stop-opacity', 0.0);
  });

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  // X scale: Secluded Cultivation Years (Time)
  const minYears = d3.min(history, (d) => d.secludedYears) ?? 0;
  const maxYears = d3.max(history, (d) => d.secludedYears) ?? 1240;
  const xDomainMin = Math.max(0, Math.floor(minYears * 0.9));
  const xDomainMax = Math.max(xDomainMin + 50, Math.ceil(maxYears * 1.04));

  const xScale = d3.scaleLinear().domain([xDomainMin, xDomainMax]).range([0, innerWidth]);

  // Y scale depends on mode: 'stage_progression' (stageScore) or 'log_power' (logPowerMult)
  const activePaths = CULTIVATION_PATH_LIST.filter((p) => visiblePaths[p] !== false);
  const allValues: number[] = [];
  history.forEach((snap) => {
    activePaths.forEach((p) => {
      const val =
        mode === 'stage_progression' ? snap.paths[p].stageScore : snap.paths[p].logPowerMult;
      allValues.push(val);
    });
  });

  const maxVal = d3.max(allValues) ?? (mode === 'stage_progression' ? 36 : 2);
  const yDomainMax =
    mode === 'stage_progression'
      ? Math.max(18, Math.ceil((maxVal + 4) / 9) * 9)
      : Math.max(1.5, Number((maxVal * 1.18).toFixed(2)));

  const yScale = d3.scaleLinear().domain([0, yDomainMax]).range([innerHeight, 0]);

  // Horizontal grid lines
  const yGridTicks = mode === 'stage_progression' ? 5 : 5;
  const gridGroup = g.append('g').attr('class', 'd3-grid-lines');
  gridGroup
    .selectAll('line')
    .data(yScale.ticks(yGridTicks))
    .join('line')
    .attr('x1', 0)
    .attr('x2', innerWidth)
    .attr('y1', (d) => yScale(d))
    .attr('y2', (d) => yScale(d))
    .attr('stroke', 'rgba(148, 163, 184, 0.14)')
    .attr('stroke-dasharray', '3,3');

  // Realm Milestone Boundary Lines when in stage_progression mode
  if (mode === 'stage_progression') {
    const maxRealmShown = Math.min(22, Math.floor(yDomainMax / 9));
    const realmStep = maxRealmShown > 6 ? 2 : 1;
    for (let rIdx = 1; rIdx <= maxRealmShown; rIdx += realmStep) {
      const boundaryScore = rIdx * 9 + 1;
      if (boundaryScore <= yDomainMax) {
        const yPos = yScale(boundaryScore);
        const realmDef = CULTIVATION_REALMS[rIdx];
        g.append('line')
          .attr('x1', 0)
          .attr('x2', innerWidth)
          .attr('y1', yPos)
          .attr('y2', yPos)
          .attr('stroke', 'rgba(251, 191, 36, 0.22)')
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '6,4');

        if (realmDef) {
          g.append('text')
            .attr('x', 6)
            .attr('y', yPos - 4)
            .attr('fill', 'rgba(253, 230, 138, 0.65)')
            .attr('font-size', '9.5px')
            .attr('font-family', 'monospace')
            .text(`${realmDef.icon} ${realmDef.name} (L${boundaryScore})`);
        }
      }
    }
  }

  // X Axis
  const xAxis = d3
    .axisBottom(xScale)
    .ticks(Math.min(7, history.length))
    .tickFormat((d) => `${d}y`);

  const xAxisG = g
    .append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(xAxis);

  xAxisG.selectAll('path, line').attr('stroke', 'rgba(148, 163, 184, 0.35)');
  xAxisG
    .selectAll('text')
    .attr('fill', '#cbd5e1')
    .attr('font-size', '10.5px')
    .attr('font-family', 'monospace');

  // X Axis Label
  g.append('text')
    .attr('x', innerWidth / 2)
    .attr('y', innerHeight + 32)
    .attr('text-anchor', 'middle')
    .attr('fill', '#94a3b8')
    .attr('font-size', '10.5px')
    .text('Secluded Cultivation Timeline (Realm Years)');

  // Y Axis
  const yAxis = d3
    .axisLeft(yScale)
    .ticks(5)
    .tickFormat((d) => {
      const num = Number(d);
      if (mode === 'stage_progression') {
        const rIdx = Math.min(22, Math.floor(Math.max(0, num - 1) / 9));
        const lNum = ((Math.max(1, Math.round(num)) - 1) % 9) + 1;
        return num === 0 ? 'Start' : `R${rIdx + 1}·L${lNum}`;
      }
      return `10^${num.toFixed(1)}x`;
    });

  const yAxisG = g.append('g').call(yAxis);
  yAxisG.selectAll('path, line').attr('stroke', 'rgba(148, 163, 184, 0.35)');
  yAxisG
    .selectAll('text')
    .attr('fill', '#cbd5e1')
    .attr('font-size', '10px')
    .attr('font-family', 'monospace');

  // Render Area & Line for each active Cultivation Path
  activePaths.forEach((path) => {
    const color = PATH_CHART_COLORS[path];
    const getVal = (snap: CultivationHistorySnapshot) =>
      mode === 'stage_progression' ? snap.paths[path].stageScore : snap.paths[path].logPowerMult;

    const areaGen = d3
      .area<CultivationHistorySnapshot>()
      .x((d) => xScale(d.secludedYears))
      .y0(innerHeight)
      .y1((d) => yScale(getVal(d)))
      .curve(d3.curveMonotoneX);

    const lineGen = d3
      .line<CultivationHistorySnapshot>()
      .x((d) => xScale(d.secludedYears))
      .y((d) => yScale(getVal(d)))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(history)
      .attr('class', `d3-cult-area d3-cult-area-${path}`)
      .attr('fill', `url(#d3-cult-grad-${path})`)
      .attr('d', areaGen);

    g.append('path')
      .datum(history)
      .attr('class', `d3-cult-line d3-cult-line-${path}`)
      .attr('data-testid', `d3-cult-line-${path}`)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 2.4)
      .attr('d', lineGen);

    // Interactive Data Nodes
    g.selectAll(`.d3-node-${path}`)
      .data(history)
      .join('circle')
      .attr('class', `cultivation-point-node d3-node-${path}`)
      .attr('data-path', path)
      .attr('cx', (d) => xScale(d.secludedYears))
      .attr('cy', (d) => yScale(getVal(d)))
      .attr('r', (_d, idx) => (idx === history.length - 1 ? 5 : 3.6))
      .attr('fill', color)
      .attr('stroke', '#020617')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('mouseenter', function (event, d) {
        d3.select(this).transition().duration(100).attr('r', 6.5);
        const pt = d.paths[path];
        const meta = CULTIVATION_PATH_META[path];
        const realmDef =
          CULTIVATION_PATHS_REALMS[path]?.[pt.realmIndex] ||
          CULTIVATION_REALMS[pt.realmIndex] ||
          CULTIVATION_REALMS[0];
        const powerMult = Math.pow(10, pt.logPowerMult);
        const powerStr =
          powerMult >= 1e6
            ? powerMult.toExponential(2) + 'x'
            : powerMult.toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'x';

        tooltip
          .style('opacity', '1')
          .html(
            `<div style="font-weight:800;color:${color};margin-bottom:2px;">${meta.icon} ${meta.name} — Year ${d.secludedYears}</div>` +
              `<div style="color:#fde68a;font-weight:700;">${realmDef.icon} ${realmDef.name} (Layer ${pt.layer}/9)</div>` +
              `<div style="color:#cbd5e1;font-family:monospace;font-size:0.7rem;margin-top:2px;">` +
              `Stage Score: <strong>${pt.stageScore.toFixed(2)}</strong> / 207<br/>` +
              `Path Multiplier: <strong style="color:#4ade80;">${powerStr}</strong><br/>` +
              `4-Path Synergy: <strong style="color:#38bdf8;">${d.combinedSynergyMult.toFixed(2)}x</strong><br/>` +
              `<span style="color:#94a3b8;">Milestone: ${d.eventLabel}</span>` +
              `</div>`
          );

        const [mx, my] = d3.pointer(event, container);
        const leftPos = Math.min(width - 230, Math.max(8, mx + 12));
        const topPos = Math.max(8, my - 68);
        tooltip.style('left', `${leftPos}px`).style('top', `${topPos}px`);
      })
      .on('mouseleave', function (_event, d) {
        const isLast = d === history[history.length - 1];
        d3.select(this)
          .transition()
          .duration(100)
          .attr('r', isLast ? 5 : 3.6);
        tooltip.style('opacity', '0');
      });

    // End-of-line direct label on the right margin for latest snapshot
    const latestSnap = history[history.length - 1];
    const latestVal = getVal(latestSnap);
    const latestPt = latestSnap.paths[path];
    const yEnd = yScale(latestVal);

    const pathLabelMap: Record<CultivationPath, number> = {
      qi: -8,
      body: 6,
      soul: -2,
      mind: 12,
    };

    g.append('text')
      .attr('x', innerWidth + 8)
      .attr('y', Math.max(8, Math.min(innerHeight, yEnd + (pathLabelMap[path] || 0) * 0.35)))
      .attr('dominant-baseline', 'middle')
      .attr('fill', color)
      .attr('font-size', '10.5px')
      .attr('font-weight', '700')
      .attr('font-family', 'monospace')
      .text(
        mode === 'stage_progression'
          ? `${path.toUpperCase()} R${latestPt.realmIndex + 1}·L${latestPt.layer}`
          : `${path.toUpperCase()} 10^${latestPt.logPowerMult.toFixed(1)}x`
      );
  });
}
