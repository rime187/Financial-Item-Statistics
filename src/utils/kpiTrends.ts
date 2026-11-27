import { EnrichedProject } from '../types';
import { PortfolioSummary, round1 } from './finance';

export type KpiMetricId =
  | 'contract'
  | 'budgetRate'
  | 'grossMargin'
  | 'collectionRate'
  | 'alertCount';

export interface KpiTrendPoint {
  month: string;
  fullMonth: string;
  value: number;
  momDelta: number | null;
}

export interface KpiTrendConfig {
  id: KpiMetricId;
  title: string;
  subtitle: string;
  unit: string;
  valueType: 'wan' | 'percent' | 'count';
  accentColor: string;
  softBg: string;
  higherIsBetter: boolean;
  targetValue?: number;
  targetLabel?: string;
  currentValue: number;
  currentFormatted: string;
  momDelta: number;
  momFormatted: string;
  isMomPositive: boolean;
  periodHighFormatted: string;
  periodLowFormatted: string;
  periodAvgFormatted: string;
  yDomain: [number, number];
  yTicks: number[];
  points: KpiTrendPoint[];
}

const MONTHS: Array<{ month: string; fullMonth: string }> = [
  { month: '6月', fullMonth: '2026年06月' },
  { month: '7月', fullMonth: '2026年07月' },
  { month: '8月', fullMonth: '2026年08月' },
  { month: '9月', fullMonth: '2026年09月' },
  { month: '10月', fullMonth: '2026年10月' },
  { month: '11月', fullMonth: '2026年11月' },
];

export function formatKpiValue(
  value: number,
  valueType: 'wan' | 'percent' | 'count'
): string {
  if (valueType === 'wan') {
    return `¥${Math.round(value).toLocaleString('zh-CN')}万`;
  }
  if (valueType === 'percent') {
    return `${value.toFixed(1)}%`;
  }
  return `${Math.round(value)} 个`;
}

export function formatKpiDelta(
  delta: number,
  valueType: 'wan' | 'percent' | 'count'
): string {
  const sign = delta > 0 ? '+' : '';
  if (valueType === 'wan') {
    return `${sign}¥${Math.round(delta).toLocaleString('zh-CN')}万`;
  }
  if (valueType === 'percent') {
    return `${sign}${delta.toFixed(1)} pct`;
  }
  return `${sign}${Math.round(delta)} 个`;
}

function computeNiceAxis(
  values: number[],
  valueType: 'wan' | 'percent' | 'count',
  targetValue?: number
): { domain: [number, number]; ticks: number[] } {
  const all = targetValue !== undefined ? [...values, targetValue] : [...values];
  const rawMin = Math.min(...all, 0);
  const rawMax = Math.max(...all, 0);

  if (valueType === 'count') {
    const top = Math.max(4, Math.ceil((rawMax + 1) / 2) * 2);
    const step = top > 10 ? Math.ceil(top / 5) : top > 6 ? 2 : 1;
    const adjustedTop = Math.ceil(top / step) * step;
    const ticks: number[] = [];
    for (let v = 0; v <= adjustedTop; v += step) ticks.push(v);
    return { domain: [0, adjustedTop], ticks };
  }

  if (valueType === 'percent') {
    const span = Math.max(20, rawMax - rawMin);
    const step = span > 80 ? 25 : span > 40 ? 20 : 10;
    const minTick = rawMin < 0 ? Math.floor(rawMin / step) * step : 0;
    const maxTick = Math.max(
      minTick + step * 3,
      Math.ceil((rawMax + step * 0.35) / step) * step
    );
    const ticks: number[] = [];
    for (let v = minTick; v <= maxTick; v += step) ticks.push(v);
    return { domain: [minTick, maxTick], ticks };
  }

  // 'wan'
  const maxRef = Math.max(rawMax, 100);
  const step =
    maxRef > 3000 ? 1000 : maxRef > 1200 ? 500 : maxRef > 400 ? 200 : 100;
  const maxTick = Math.max(step * 3, Math.ceil((maxRef * 1.1) / step) * step);
  const ticks: number[] = [];
  for (let v = 0; v <= maxTick; v += step) ticks.push(v);
  return { domain: [0, maxTick], ticks };
}

/**
 * Derive a deterministic 6-month historical curve anchored strictly to the
 * live filtered portfolio summary in the latest month (2026年11月).
 */
export function buildKpiTrendConfig(
  metricId: KpiMetricId,
  projects: EnrichedProject[],
  summary: PortfolioSummary
): KpiTrendConfig {
  const count = projects.length;
  // Deterministic portfolio fingerprint so different filtered slices have distinct subtle wave shapes
  const seed = projects.reduce(
    (acc, p, idx) => acc + (p.contractAmount + p.progress * 3) * (idx + 1),
    0
  );
  const wave = (idx: number) => Math.sin((seed * 0.013 + idx * 1.35)) * 0.5;

  let rawValues: number[];
  let title: string;
  let subtitle: string;
  let unit: string;
  let valueType: 'wan' | 'percent' | 'count';
  let accentColor: string;
  let softBg: string;
  let higherIsBetter: boolean;
  let targetValue: number | undefined;
  let targetLabel: string | undefined;

  switch (metricId) {
    case 'contract': {
      title = '立项合同总额';
      subtitle = '近 6 个月累计立项签约合同金额走势（万元）';
      unit = '万元';
      valueType = 'wan';
      accentColor = '#2563EB';
      softBg = '#EFF6FF';
      higherIsBetter = true;
      const cur = round1(summary.totalContract);
      const ratios = [0.64, 0.72, 0.79, 0.87, 0.94, 1];
      rawValues = ratios.map((r, i) =>
        i === 5
          ? cur
          : cur <= 0
            ? 0
            : Math.max(0, round1(cur * (r + wave(i) * 0.025)))
      );
      break;
    }

    case 'budgetRate': {
      title = '预算消耗率';
      subtitle = '近 6 个月部门项目累计预算执行消耗率波动（%）';
      unit = '%';
      valueType = 'percent';
      accentColor =
        summary.overallBudgetConsumptionRate > 100 ? '#EF4444' : '#6366F1';
      softBg =
        summary.overallBudgetConsumptionRate > 100 ? '#FEF2F2' : '#EEF2FF';
      higherIsBetter = false;
      targetValue = 100;
      targetLabel = '预算红线 100%';
      const cur = round1(summary.overallBudgetConsumptionRate);
      const offsets = [-24.6, -18.2, -13.5, -7.8, -3.4, 0];
      rawValues = offsets.map((off, i) =>
        i === 5
          ? cur
          : cur <= 0
            ? 0
            : Math.max(0, round1(cur + off + wave(i) * 2.4))
      );
      break;
    }

    case 'grossMargin': {
      title = '确认收入毛利率';
      subtitle = '近 6 个月按完工百分比核算的综合毛利率变化（%）';
      unit = '%';
      valueType = 'percent';
      const healthy = summary.overallGrossMargin >= 32;
      accentColor = healthy ? '#10B981' : '#F59E0B';
      softBg = healthy ? '#ECFDF5' : '#FFFBEB';
      higherIsBetter = true;
      targetValue = 32;
      targetLabel = '目标毛利线 32%';
      const cur = round1(summary.overallGrossMargin);
      const offsets = [6.4, 5.1, 3.2, 4.0, 1.6, 0];
      rawValues = offsets.map((off, i) =>
        i === 5
          ? cur
          : count === 0
            ? 0
            : round1(cur + off + wave(i) * 1.9)
      );
      break;
    }

    case 'collectionRate': {
      title = '回款率 & 应收';
      subtitle = '近 6 个月合同累计资金回笼率月度推进曲线（%）';
      unit = '%';
      valueType = 'percent';
      accentColor = '#F59E0B';
      softBg = '#FFFBEB';
      higherIsBetter = true;
      const cur = round1(summary.overallCollectionRate);
      const offsets = [-15.8, -11.4, -8.9, -5.2, -2.6, 0];
      rawValues = offsets.map((off, i) =>
        i === 5
          ? cur
          : cur <= 0
            ? 0
            : Math.max(0, Math.min(100, round1(cur + off + wave(i) * 2.1)))
      );
      break;
    }

    case 'alertCount': {
      title = '异常预警项目';
      subtitle = '近 6 个月触发超支或账期逾60天预警的项目数变化（个）';
      unit = '个';
      valueType = 'count';
      accentColor = '#EF4444';
      softBg = '#FEF2F2';
      higherIsBetter = false;
      const cur = summary.alertCount;
      const offsets = [-3, -2, -2, -1, -1, 0];
      rawValues = offsets.map((off, i) => {
        if (i === 5) return cur;
        if (count === 0) return 0;
        const base = cur + off + (i === 2 && cur >= 3 ? 1 : 0);
        return Math.max(0, Math.min(count, Math.round(base)));
      });
      break;
    }
  }

  const points: KpiTrendPoint[] = MONTHS.map((m, idx) => {
    const val = rawValues[idx];
    const prev = idx > 0 ? rawValues[idx - 1] : null;
    const momDelta = prev !== null ? round1(val - prev) : null;
    return {
      month: m.month,
      fullMonth: m.fullMonth,
      value: val,
      momDelta,
    };
  });

  const currentValue = points[points.length - 1].value;
  const prevValue = points[points.length - 2].value;
  const momDelta = round1(currentValue - prevValue);
  const high = Math.max(...rawValues);
  const low = Math.min(...rawValues);
  const avg = round1(rawValues.reduce((s, v) => s + v, 0) / rawValues.length);
  const { domain: yDomain, ticks: yTicks } = computeNiceAxis(
    rawValues,
    valueType,
    targetValue
  );

  const isMomPositive =
    momDelta === 0 ? true : higherIsBetter ? momDelta > 0 : momDelta < 0;

  return {
    id: metricId,
    title,
    subtitle,
    unit,
    valueType,
    accentColor,
    softBg,
    higherIsBetter,
    targetValue,
    targetLabel,
    currentValue,
    currentFormatted: formatKpiValue(currentValue, valueType),
    momDelta,
    momFormatted: formatKpiDelta(momDelta, valueType),
    isMomPositive,
    periodHighFormatted: formatKpiValue(high, valueType),
    periodLowFormatted: formatKpiValue(low, valueType),
    periodAvgFormatted: formatKpiValue(avg, valueType),
    yDomain,
    yTicks,
    points,
  };
}
