import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_MOCK_PROJECTS } from '../data/mockProjects';
import { calcPortfolioSummary, enrichProjects, round1 } from './finance';
import { buildKpiTrendConfig, KpiMetricId } from './kpiTrends';

const enriched = enrichProjects(INITIAL_MOCK_PROJECTS);
const summary = calcPortfolioSummary(enriched);

test('each KPI trend generates exactly 6 monthly points anchored to current summary', () => {
  const metricIds: KpiMetricId[] = [
    'contract',
    'budgetRate',
    'grossMargin',
    'collectionRate',
    'alertCount',
  ];

  const expectedLatest: Record<KpiMetricId, number> = {
    contract: round1(summary.totalContract),
    budgetRate: round1(summary.overallBudgetConsumptionRate),
    grossMargin: round1(summary.overallGrossMargin),
    collectionRate: round1(summary.overallCollectionRate),
    alertCount: summary.alertCount,
  };

  for (const id of metricIds) {
    const cfg = buildKpiTrendConfig(id, enriched, summary);
    assert.equal(cfg.points.length, 6, `${id} should have 6 monthly points`);
    assert.equal(
      cfg.points[5].value,
      expectedLatest[id],
      `${id} latest point should match live summary`
    );
    assert.equal(cfg.points[0].momDelta, null);
    assert.equal(
      cfg.points[5].momDelta,
      cfg.momDelta,
      `${id} latest MoM delta should match summary momDelta`
    );
    assert.ok(cfg.yTicks.length >= 3, `${id} should generate clean Y ticks`);
  }
});

test('KPI trend handles empty filtered project list cleanly without NaN', () => {
  const emptySummary = calcPortfolioSummary([]);
  const cfg = buildKpiTrendConfig('grossMargin', [], emptySummary);
  assert.equal(cfg.points.length, 6);
  for (const pt of cfg.points) {
    assert.equal(Number.isFinite(pt.value), true);
    assert.equal(pt.value, 0);
  }
});

test('budgetRate and grossMargin expose benchmark reference lines', () => {
  const budgetCfg = buildKpiTrendConfig('budgetRate', enriched, summary);
  const marginCfg = buildKpiTrendConfig('grossMargin', enriched, summary);
  assert.equal(budgetCfg.targetValue, 100);
  assert.equal(marginCfg.targetValue, 32);
});
