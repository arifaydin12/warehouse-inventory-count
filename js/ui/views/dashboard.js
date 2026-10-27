// Dashboard: KPIs, charts, session progress and recent activity.

import { h, fill } from '../dom.js';
import { icon } from '../icons.js';
import { badge, kpiCard, pageHeader, progressBar, statusTone, emptyState, button } from '../components.js';
import { groupedBarChart, columnChart, donutChart, legend, fitChart } from '../charts.js';
import { t, tn, formatNumber, formatPercent, formatMoney, formatDate, formatDateTime } from '../../i18n.js';
import { getData } from '../../core/store.js';
import { summarize, byCategory, countsPerDay } from '../../domain/discrepancy.js';
import { can } from '../../domain/permissions.js';
import { auditText, categoryLabel, sessionName, statusLabel, warehouseById } from '../format.js';

export function mountDashboard(root, { user, navigate }) {
  let disposers = [];
  function render() {
    disposers.forEach((d) => d());
    disposers = [];
    const chartHolder = (build) => {
      const holder = h('div', { class: 'chart-holder' });
      queueMicrotask(() => {
        disposers.push(fitChart(holder, build));
      });
      return holder;
    };
    const data = getData();
    const live = data.sessions.filter((s) => s.status !== 'cancelled');
    const allLines = live.flatMap((s) => s.lines);
    const totals = summarize(allLines);
    const units = data.products.reduce((sum, p) => sum + p.expected, 0);
    const stockValue = data.products.reduce((sum, p) => sum + p.expected * (p.unitCost || 0), 0);
    const active = data.sessions.filter((s) => s.status === 'open' || s.status === 'recount');
    const waiting = data.sessions.filter((s) => s.status === 'submitted');
    const reviewed = summarize(live.filter((s) => s.status === 'submitted' || s.status === 'approved').flatMap((s) => s.lines));

    const kpis = h(
      'section',
      { class: 'kpi-grid', 'aria-label': t('dashboard.kpis') },
      kpiCard({ label: t('dashboard.products'), value: formatNumber(data.products.length), hint: tn('dashboard.inWarehouses', data.warehouses.length) }),
      kpiCard({ label: t('dashboard.stockUnits'), value: formatNumber(units), hint: t('dashboard.stockValue', { value: formatMoney(stockValue) }) }),
      kpiCard({ label: t('dashboard.activeSessions'), value: formatNumber(active.length), hint: t('dashboard.awaitingReview', { n: waiting.length }), tone: waiting.length ? 'warn' : null }),
      kpiCard({ label: t('dashboard.accuracy'), value: formatPercent(totals.accuracy), hint: t('dashboard.accuracyHint', { counted: totals.counted }), tone: 'success' }),
      kpiCard({ label: t('dashboard.netVariance'), value: formatMoney(reviewed.netValue), hint: t('dashboard.netVarianceHint'), tone: reviewed.netValue < 0 ? 'danger' : null }),
    );

    // Discrepancies by category
    const cats = byCategory(allLines);
    const catChart = cats.length
      ? h(
          'div',
          {},
          chartHolder((width) => groupedBarChart({
            width,
            categories: cats.map((c) => ({ label: categoryLabel(c.category), values: [c.shortageUnits, c.surplusUnits] })),
            series: [
              { name: t('dashboard.shortage'), cls: 'c-short' },
              { name: t('dashboard.surplus'), cls: 'c-surplus' },
            ],
            ariaLabel: t('dashboard.chartCategoryAria', {
              summary: cats.map((c) => `${categoryLabel(c.category)}: −${c.shortageUnits} / +${c.surplusUnits}`).join('; '),
            }),
          })),
          legend([
            { label: t('dashboard.shortage'), cls: 'c-short' },
            { label: t('dashboard.surplus'), cls: 'c-surplus' },
          ]),
        )
      : emptyState({ title: t('dashboard.noCounts'), text: t('dashboard.noCountsHint') });

    // Results donut
    const donut = h(
      'div',
      { class: 'donut-wrap' },
      donutChart({
        segments: [
          { label: t('line.match'), value: totals.matched, cls: 'seg c-match' },
          { label: t('line.shortage'), value: totals.shortageLines, cls: 'seg c-short' },
          { label: t('line.surplus'), value: totals.surplusLines, cls: 'seg c-surplus' },
          { label: t('line.uncounted'), value: totals.uncounted, cls: 'seg c-uncounted' },
        ],
        centerValue: formatPercent(totals.accuracy),
        centerLabel: t('dashboard.accuracy'),
        ariaLabel: t('dashboard.chartResultsAria', { match: totals.matched, shortage: totals.shortageLines, surplus: totals.surplusLines, uncounted: totals.uncounted }),
      }),
      legend([
        { label: t('line.match'), cls: 'c-match', value: totals.matched },
        { label: t('line.shortage'), cls: 'c-short', value: totals.shortageLines },
        { label: t('line.surplus'), cls: 'c-surplus', value: totals.surplusLines },
        { label: t('line.uncounted'), cls: 'c-uncounted', value: totals.uncounted },
      ]),
    );

    // Counts per day
    const perDay = countsPerDay(live, Date.now(), 14);
    const perDayChart = chartHolder((width) => columnChart({
      width,
      data: perDay.map((d) => ({ label: formatDate(d.date, { day: '2-digit', month: '2-digit' }), value: d.lines })),
      cls: 'c-count',
      unitLabel: t('dashboard.items'),
      ariaLabel: t('dashboard.chartDailyAria', { total: perDay.reduce((n, d) => n + d.lines, 0) }),
    }));

    // Session progress
    const progress = active.length || waiting.length
      ? h(
          'ul',
          { class: 'progress-list' },
          [...active, ...waiting].map((s) => {
            const sum = summarize(s.lines);
            return h(
              'li',
              {},
              h(
                'div',
                { class: 'progress-row-head' },
                h('a', { href: `#/sessions/${encodeURIComponent(s.id)}`, class: 'link-strong' }, sessionName(s)),
                badge(statusLabel(s.status), statusTone(s.status)),
              ),
              h('div', { class: 'muted small' }, `${warehouseById(s.warehouseId)} · ${t('dashboard.progressText', { counted: sum.counted, total: sum.total })}`),
              progressBar(sum.progress, `${sessionName(s)}: ${formatPercent(sum.progress)}`),
            );
          }),
        )
      : emptyState({ title: t('dashboard.noActive'), text: t('dashboard.noActiveHint'), action: can(user.role, 'sessions.create') ? button(t('sessions.new'), { variant: 'primary', iconName: 'plus', onClick: () => navigate('sessions') }) : null });

    // Recent activity
    const recent = can(user.role, 'audit.view')
      ? h(
          'section',
          { class: 'card' },
          h('div', { class: 'card-head' }, h('h2', {}, t('dashboard.recentActivity')), h('a', { href: '#/audit', class: 'link' }, t('dashboard.viewAll'))),
          h(
            'ul',
            { class: 'activity-list' },
            [...data.audit].reverse().slice(0, 6).map((e) =>
              h('li', {}, h('span', { class: 'activity-text' }, h('strong', {}, e.userName), ' – ', auditText(e)), h('time', { class: 'muted small', datetime: new Date(e.ts).toISOString() }, formatDateTime(e.ts))),
            ),
          ),
        )
      : null;

    const waitingAlert = waiting.length && can(user.role, 'sessions.review')
      ? h(
          'div',
          { class: 'alert alert-warn' },
          icon('alert'),
          h('span', {}, tn('dashboard.reviewAlert', waiting.length)),
          h('a', { class: 'btn btn-sm', href: `#/sessions/${encodeURIComponent(waiting[0].id)}` }, t('dashboard.reviewNow')),
        )
      : null;

    fill(root, 
      pageHeader(t('nav.dashboard'), t('dashboard.welcome', { name: user.name.split(' ')[0] })),
      waitingAlert,
      kpis,
      h(
        'div',
        { class: 'grid grid-2' },
        h('section', { class: 'card' }, h('h2', {}, t('dashboard.byCategory')), h('p', { class: 'muted small' }, t('dashboard.byCategoryHint')), catChart),
        h('section', { class: 'card' }, h('h2', {}, t('dashboard.results')), h('p', { class: 'muted small' }, t('dashboard.resultsHint')), donut),
      ),
      h(
        'div',
        { class: 'grid grid-2' },
        h('section', { class: 'card' }, h('h2', {}, t('dashboard.perDay')), h('p', { class: 'muted small' }, t('dashboard.perDayHint')), perDayChart),
        h('section', { class: 'card' }, h('h2', {}, t('dashboard.sessionProgress')), progress),
      ),
      recent,
    );
  }
  render();
  return {
    refresh: render,
    destroy: () => disposers.forEach((d) => d()),
  };
}
