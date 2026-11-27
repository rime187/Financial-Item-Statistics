import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  FileText,
  PieChart as PieChartIcon,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CATEGORY_COLORS, EnrichedProject, TabId } from '../types';
import {
  calcBusinessGroupMetrics,
  calcPortfolioSummary,
  round1,
} from '../utils/finance';
import { buildKpiTrendConfig, KpiMetricId } from '../utils/kpiTrends';
import { KpiTrendModal } from './KpiTrendModal';

interface ExecutiveCockpitProps {
  projects: EnrichedProject[];
  onInspectProject: (projectId: string) => void;
  onNavigateTab: (tab: TabId) => void;
}

function shortProjectName(name: string): string {
  return name.length > 8 ? `${name.slice(0, 8)}…` : name;
}

export const ExecutiveCockpit: React.FC<ExecutiveCockpitProps> = ({
  projects,
  onInspectProject,
  onNavigateTab,
}) => {
  const summary = useMemo(() => calcPortfolioSummary(projects), [projects]);
  const [activeTrendMetric, setActiveTrendMetric] =
    useState<KpiMetricId | null>(null);

  const activeTrendConfig = useMemo(
    () =>
      activeTrendMetric
        ? buildKpiTrendConfig(activeTrendMetric, projects, summary)
        : null,
    [activeTrendMetric, projects, summary]
  );

  const top8ChartData = useMemo(() => {
    return [...projects]
      .sort((a, b) => b.approvedBudget - a.approvedBudget)
      .slice(0, 8)
      .map((p) => ({
        id: p.id,
        shortName: shortProjectName(p.name),
        fullName: p.name,
        code: p.code,
        approvedBudget: round1(p.approvedBudget),
        actualCost: round1(p.metrics.actualCost),
        collectedAmount: round1(p.collectedAmount),
        grossMargin: round1(p.metrics.grossMargin),
        isOverBudget: p.metrics.isOverBudget,
      }));
  }, [projects]);

  const { barYMax, barYTicks } = useMemo(() => {
    let rawMax = 0;
    for (const item of top8ChartData) {
      rawMax = Math.max(
        rawMax,
        item.approvedBudget,
        item.actualCost,
        item.collectedAmount
      );
    }
    const step = rawMax > 400 ? 100 : 50;
    const maxVal = Math.max(step * 2, Math.ceil(rawMax / step) * step);
    const ticks: number[] = [];
    for (let v = 0; v <= maxVal; v += step) {
      ticks.push(v);
    }
    return { barYMax: maxVal, barYTicks: ticks };
  }, [top8ChartData]);

  const donutData = useMemo(() => {
    const total = summary.totalActualCost || 1;
    const items = [
      {
        name: '人工工时',
        value: round1(summary.categoryTotals.labor),
        percent: ((summary.categoryTotals.labor / total) * 100).toFixed(1),
        color: CATEGORY_COLORS['人工工时'],
      },
      {
        name: '软硬件采购',
        value: round1(summary.categoryTotals.procurement),
        percent: ((summary.categoryTotals.procurement / total) * 100).toFixed(1),
        color: CATEGORY_COLORS['软硬件采购'],
      },
      {
        name: '外包技术',
        value: round1(summary.categoryTotals.outsourcing),
        percent: ((summary.categoryTotals.outsourcing / total) * 100).toFixed(1),
        color: CATEGORY_COLORS['外包技术'],
      },
      {
        name: '差旅实施',
        value: round1(summary.categoryTotals.travel),
        percent: ((summary.categoryTotals.travel / total) * 100).toFixed(1),
        color: CATEGORY_COLORS['差旅实施'],
      },
    ];
    return items;
  }, [summary]);

  const groupMetrics = useMemo(
    () => calcBusinessGroupMetrics(projects),
    [projects]
  );

  const { groupLeftTicks, groupRightTicks } = useMemo(() => {
    let maxAmt = 0;
    let minMargin = 0;
    let maxMargin = 45;
    for (const g of groupMetrics) {
      maxAmt = Math.max(maxAmt, g.recognizedRevenue, g.actualCost);
      minMargin = Math.min(minMargin, g.grossMargin);
      maxMargin = Math.max(maxMargin, g.grossMargin);
    }
    const amtStep = maxAmt > 800 ? 250 : maxAmt > 400 ? 200 : 100;
    const amtTop = Math.max(amtStep * 3, Math.ceil(maxAmt / amtStep) * amtStep);
    const leftTicks: number[] = [];
    for (let v = 0; v <= amtTop; v += amtStep) leftTicks.push(v);

    const mStep = 15;
    const mMin = minMargin < 0 ? Math.floor(minMargin / mStep) * mStep : 0;
    const mMax = Math.max(45, Math.ceil(maxMargin / mStep) * mStep);
    const rightTicks: number[] = [];
    for (let v = mMin; v <= mMax; v += mStep) rightTicks.push(v);

    return { groupLeftTicks: leftTicks, groupRightTicks: rightTicks };
  }, [groupMetrics]);

  const alertProjects = useMemo(() => {
    return projects
      .filter(
        (p) =>
          p.metrics.healthStatus === '超支' ||
          (p.maxOverdueDays > 60 && p.metrics.uncollectedReceivable > 0)
      )
      .sort((a, b) => {
        if (a.metrics.healthStatus === '超支' && b.metrics.healthStatus !== '超支') {
          return -1;
        }
        if (a.metrics.healthStatus !== '超支' && b.metrics.healthStatus === '超支') {
          return 1;
        }
        return b.metrics.budgetConsumptionRate - a.metrics.budgetConsumptionRate;
      });
  }, [projects]);

  const budgetBarBasePct = Math.min(100, summary.overallBudgetConsumptionRate);
  const budgetBarOverPct =
    summary.overallBudgetConsumptionRate > 100
      ? Math.min(100, summary.overallBudgetConsumptionRate - 100)
      : 0;
  const isGrossMarginHealthy = summary.overallGrossMargin >= 32;

  return (
    <div className="flex flex-col gap-5">
      {/* Row 1: 5 Equal-Width KPI Cards with Unified Vertical Baseline & Trend Trigger */}
      <section
        aria-label="核心财务指标"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 items-stretch"
      >
        {/* KPI 1: 立项合同总额 */}
        <article
          onClick={() => setActiveTrendMetric('contract')}
          className="group bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4 xl:p-5 flex flex-col cursor-pointer transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-blue-300/80 hover:shadow-[0_10px_24px_-8px_rgba(37,99,235,0.14)] active:translate-y-0 active:scale-[0.99]"
        >
          <div className="h-9 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#475569] whitespace-nowrap">
              立项合同总额
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-3 text-[26px] xl:text-[28px] leading-9 font-bold tracking-tight text-[#0F172A] tabular-nums whitespace-nowrap">
            ¥{Math.round(summary.totalContract).toLocaleString('zh-CN')}万
          </p>
          <div className="mt-auto pt-3 flex items-center justify-between gap-1.5">
            <span className="text-[11px] xl:text-xs text-[#64748B] tabular-nums whitespace-nowrap truncate min-w-0">
              覆盖 {summary.projectCount} 个项目 · 开票{' '}
              {summary.overallInvoicedRate.toFixed(1)}%
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveTrendMetric('contract');
              }}
              aria-label="查看立项合同总额近6个月趋势图"
              title="查看趋势图"
              className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-slate-400 bg-slate-50/90 border border-slate-200/70 transition-all duration-200 group-hover:text-[#2563EB] group-hover:bg-[#EFF6FF] group-hover:border-blue-200 cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5" />
            </button>
          </div>
        </article>

        {/* KPI 2: 预算消耗率 */}
        <article
          onClick={() => setActiveTrendMetric('budgetRate')}
          className="group bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4 xl:p-5 flex flex-col cursor-pointer transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-indigo-300/80 hover:shadow-[0_10px_24px_-8px_rgba(99,102,241,0.14)] active:translate-y-0 active:scale-[0.99]"
        >
          <div className="h-9 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#475569] whitespace-nowrap">
              预算消耗率
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#EEF2FF] text-[#6366F1] flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105">
              <PieChartIcon className="w-4 h-4" />
            </div>
          </div>
          <p
            className={`mt-3 text-[26px] xl:text-[28px] leading-9 font-bold tracking-tight tabular-nums whitespace-nowrap ${
              summary.overallBudgetConsumptionRate > 100
                ? 'text-[#EF4444]'
                : 'text-[#0F172A]'
            }`}
          >
            {summary.overallBudgetConsumptionRate.toFixed(1)}%
          </p>
          <div className="mt-2 w-full h-1.5 rounded-full bg-slate-100 overflow-hidden flex">
            <div
              className="h-full bg-[#6366F1] transition-all duration-300"
              style={{ width: `${budgetBarBasePct}%` }}
            />
            {budgetBarOverPct > 0 && (
              <div
                className="h-full bg-[#EF4444] transition-all duration-300"
                style={{ width: `${budgetBarOverPct}%` }}
              />
            )}
          </div>
          <div className="mt-auto pt-2 flex items-center justify-between gap-1.5">
            <span className="text-[11px] xl:text-xs text-[#64748B] tabular-nums whitespace-nowrap truncate min-w-0">
              已发¥{Math.round(summary.totalActualCost).toLocaleString('zh-CN')}
              万 / 预算¥{Math.round(summary.totalBudget).toLocaleString('zh-CN')}
              万
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveTrendMetric('budgetRate');
              }}
              aria-label="查看预算消耗率近6个月趋势图"
              title="查看趋势图"
              className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-slate-400 bg-slate-50/90 border border-slate-200/70 transition-all duration-200 group-hover:text-[#6366F1] group-hover:bg-[#EEF2FF] group-hover:border-indigo-200 cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5" />
            </button>
          </div>
        </article>

        {/* KPI 3: 确认收入毛利率 */}
        <article
          onClick={() => setActiveTrendMetric('grossMargin')}
          className={`group bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4 xl:p-5 flex flex-col cursor-pointer transition-all duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] ${
            isGrossMarginHealthy
              ? 'hover:border-emerald-300/80 hover:shadow-[0_10px_24px_-8px_rgba(16,185,129,0.14)]'
              : 'hover:border-amber-300/80 hover:shadow-[0_10px_24px_-8px_rgba(245,158,11,0.15)]'
          }`}
        >
          <div className="h-9 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#475569] whitespace-nowrap">
              确认收入毛利率
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#ECFDF5] text-[#10B981] flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p
            className={`mt-3 text-[26px] xl:text-[28px] leading-9 font-bold tracking-tight tabular-nums whitespace-nowrap ${
              isGrossMarginHealthy ? 'text-[#10B981]' : 'text-[#F59E0B]'
            }`}
          >
            {summary.overallGrossMargin.toFixed(1)}%
          </p>
          <div className="mt-auto pt-3 flex items-center justify-between gap-1.5">
            <span className="text-[11px] xl:text-xs text-[#64748B] tabular-nums whitespace-nowrap truncate min-w-0">
              毛利 ¥{summary.totalGrossProfit.toFixed(1)}万 (目标 ≥32%)
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveTrendMetric('grossMargin');
              }}
              aria-label="查看确认收入毛利率近6个月趋势图"
              title="查看趋势图"
              className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-slate-400 bg-slate-50/90 border border-slate-200/70 transition-all duration-200 cursor-pointer ${
                isGrossMarginHealthy
                  ? 'group-hover:text-[#10B981] group-hover:bg-[#ECFDF5] group-hover:border-emerald-200'
                  : 'group-hover:text-[#D97706] group-hover:bg-[#FFFBEB] group-hover:border-amber-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
            </button>
          </div>
        </article>

        {/* KPI 4: 回款率 & 应收 */}
        <article
          onClick={() => setActiveTrendMetric('collectionRate')}
          className="group bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4 xl:p-5 flex flex-col cursor-pointer transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-amber-300/80 hover:shadow-[0_10px_24px_-8px_rgba(245,158,11,0.15)] active:translate-y-0 active:scale-[0.99]"
        >
          <div className="h-9 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#475569] whitespace-nowrap">
              回款率 & 应收
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#FFFBEB] text-[#F59E0B] flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-3 text-[26px] xl:text-[28px] leading-9 font-bold tracking-tight text-[#0F172A] tabular-nums whitespace-nowrap">
            {summary.overallCollectionRate.toFixed(1)}%
          </p>
          <div className="mt-auto pt-3 flex items-center justify-between gap-1.5">
            <span className="text-[11px] xl:text-xs text-[#64748B] tabular-nums whitespace-nowrap truncate min-w-0">
              已回 ¥{Math.round(summary.totalCollected).toLocaleString('zh-CN')}万 ·
              未回 ¥{Math.round(summary.totalUncollected).toLocaleString('zh-CN')}万
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveTrendMetric('collectionRate');
              }}
              aria-label="查看回款率与应收近6个月趋势图"
              title="查看趋势图"
              className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-slate-400 bg-slate-50/90 border border-slate-200/70 transition-all duration-200 group-hover:text-[#D97706] group-hover:bg-[#FFFBEB] group-hover:border-amber-200 cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5" />
            </button>
          </div>
        </article>

        {/* KPI 5: 异常预警项目 */}
        <article
          onClick={() => setActiveTrendMetric('alertCount')}
          className="group bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4 xl:p-5 flex flex-col cursor-pointer transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-red-300/80 hover:shadow-[0_10px_24px_-8px_rgba(239,68,68,0.14)] active:translate-y-0 active:scale-[0.99]"
        >
          <div className="h-9 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#475569] whitespace-nowrap">
              异常预警项目
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#FEF2F2] text-[#EF4444] flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-3 text-[26px] xl:text-[28px] leading-9 font-bold tracking-tight text-[#EF4444] tabular-nums whitespace-nowrap">
            {summary.alertCount} 个
          </p>
          <div className="mt-auto pt-3 flex items-center justify-between gap-1.5">
            <span className="text-[11px] xl:text-xs text-[#64748B] tabular-nums whitespace-nowrap truncate min-w-0">
              超支 {summary.overrunCount} 个 · 逾期&gt;60天 ¥
              {Math.round(summary.overdue60PlusAmount).toLocaleString('zh-CN')}万
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveTrendMetric('alertCount');
              }}
              aria-label="查看异常预警项目近6个月趋势图"
              title="查看趋势图"
              className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-slate-400 bg-slate-50/90 border border-slate-200/70 transition-all duration-200 group-hover:text-[#EF4444] group-hover:bg-[#FEF2F2] group-hover:border-red-200 cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5" />
            </button>
          </div>
        </article>
      </section>

      {/* Row 2: 64% / 36% Grid (Bar Comparison + Cost Donut) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Card (~65% -> 8/12) */}
        <article className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-6 flex flex-col justify-between gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold text-[#0F172A]">
                项目预算 vs 实际成本 vs 已回款对比 (按项目Top 8)
              </h2>
              <p className="text-xs text-[#64748B]">
                直观识别「高投入低回款」与「成本突破预算红线」项目 · 点击任意项目柱子可直接穿透核查
              </p>
            </div>
            <span className="text-xs font-medium text-[#64748B] whitespace-nowrap">
              单位：万元 (RMB)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-[#475569]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#CBD5E1]" />
              <span>核定总预算</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#3B82F6]" />
              <span>实际已发生成本 (正常)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#EF4444]" />
              <span>实际已发生成本 (超预算)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#10B981]" />
              <span>累计已回款</span>
            </div>
          </div>

          {top8ChartData.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-sm text-[#64748B]">
              当前筛选条件下暂无项目数据
            </div>
          ) : (
            <div className="w-full h-[290px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={top8ChartData}
                  margin={{ top: 10, right: 8, left: 18, bottom: 28 }}
                  barGap={4}
                  barCategoryGap="20%"
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#F1F5F9"
                  />
                  <XAxis
                    dataKey="shortName"
                    tick={{ fill: '#475569', fontSize: 11 }}
                    axisLine={{ stroke: '#E2E8F0' }}
                    tickLine={false}
                    interval={0}
                    angle={-16}
                    textAnchor="end"
                    height={48}
                  />
                  <YAxis
                    domain={[0, barYMax]}
                    ticks={barYTicks}
                    interval={0}
                    width={36}
                    tick={{ fill: '#64748B', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: '#F8FAFC' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const item = payload[0].payload;
                      const over = item.actualCost > item.approvedBudget;
                      return (
                        <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs min-w-[208px]">
                          <div className="font-semibold text-[#0F172A] mb-0.5">
                            {item.fullName}
                          </div>
                          <div className="text-[#64748B] mb-2 tabular-nums">
                            {item.code}
                          </div>
                          <div className="flex flex-col gap-1 tabular-nums">
                            <div className="flex justify-between gap-4">
                              <span className="text-[#64748B]">核定总预算</span>
                              <span className="font-medium text-[#0F172A]">
                                ¥{item.approvedBudget.toFixed(1)}万
                              </span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-[#64748B]">实际发生成本</span>
                              <span
                                className={`font-semibold ${
                                  over ? 'text-[#EF4444]' : 'text-[#2563EB]'
                                }`}
                              >
                                ¥{item.actualCost.toFixed(1)}万
                                {over ? ' (超预算)' : ''}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-[#64748B]">累计已回款</span>
                              <span className="font-medium text-[#10B981]">
                                ¥{item.collectedAmount.toFixed(1)}万
                              </span>
                            </div>
                            <div className="pt-1 mt-1 border-t border-slate-100 flex justify-between gap-4">
                              <span className="text-[#64748B]">核算毛利率</span>
                              <span
                                className={`font-semibold ${
                                  item.grossMargin < 32
                                    ? 'text-[#F59E0B]'
                                    : 'text-[#10B981]'
                                }`}
                              >
                                {item.grossMargin.toFixed(1)}%
                              </span>
                            </div>
                            <div className="pt-1 text-[11px] text-[#2563EB] font-medium">
                              点击柱子可打开穿透核查抽屉 →
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="approvedBudget"
                    name="核定总预算"
                    fill="#CBD5E1"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={20}
                    isAnimationActive={false}
                    cursor="pointer"
                    onClick={(data) => {
                      const id = data?.payload?.id ?? data?.id;
                      if (typeof id === 'string') onInspectProject(id);
                    }}
                  />
                  <Bar
                    dataKey="actualCost"
                    name="实际已发生成本"
                    fill="#3B82F6"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={20}
                    isAnimationActive={false}
                    cursor="pointer"
                    onClick={(data) => {
                      const id = data?.payload?.id ?? data?.id;
                      if (typeof id === 'string') onInspectProject(id);
                    }}
                  >
                    {top8ChartData.map((entry) => {
                      const isOver =
                        entry.isOverBudget ||
                        entry.actualCost > entry.approvedBudget;
                      return (
                        <Cell
                          key={`cost-${entry.id}-${isOver ? 'over' : 'normal'}-${entry.actualCost}`}
                          fill={isOver ? '#EF4444' : '#3B82F6'}
                        />
                      );
                    })}
                  </Bar>
                  <Bar
                    dataKey="collectedAmount"
                    name="累计已回款"
                    fill="#10B981"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={20}
                    isAnimationActive={false}
                    cursor="pointer"
                    onClick={(data) => {
                      const id = data?.payload?.id ?? data?.id;
                      if (typeof id === 'string') onInspectProject(id);
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>

        {/* Right Card (~35% -> 4/12): Large Thick Donut Chart + Strict 2x2 Legend */}
        <article className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-6 flex flex-col justify-between gap-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-[#0F172A]">
              总成本科目构成拆解
            </h2>
            <p className="text-xs text-[#64748B]">
              人工工时、软硬件采购、外包服务与差旅实施占比
            </p>
          </div>

          <div className="relative w-full h-[248px] flex items-center justify-center my-auto">
            {summary.totalActualCost > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={108}
                      startAngle={90}
                      endAngle={-270}
                      paddingAngle={3}
                      stroke="#FFFFFF"
                      strokeWidth={3}
                      isAnimationActive={false}
                    >
                      {donutData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="bg-white border border-slate-200 rounded-lg shadow-md px-3 py-2 text-xs tabular-nums">
                            <div className="font-semibold text-[#0F172A]">
                              {d.name}
                            </div>
                            <div className="text-[#475569] mt-0.5">
                              ¥{d.value.toFixed(1)}万 ({d.percent}%)
                            </div>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xs font-medium text-[#64748B]">
                    累计总成本
                  </span>
                  <span className="text-[20px] leading-7 font-bold text-[#0F172A] tabular-nums mt-0.5">
                    ¥
                    {summary.totalActualCost.toLocaleString('zh-CN', {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}
                    万
                  </span>
                </div>
              </>
            ) : (
              <div className="text-xs text-[#64748B]">暂无成本发生额</div>
            )}
          </div>

          {/* Strict Non-Wrapping 2x2 Grid Legend */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 pt-4 border-t border-slate-100">
            {donutData.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between gap-2 min-w-0 whitespace-nowrap"
                title={`${item.name}：¥${item.value.toFixed(1)}万`}
              >
                <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs text-[#475569] whitespace-nowrap">
                    {item.name}
                  </span>
                </div>
                <span className="text-xs font-semibold text-[#0F172A] tabular-nums shrink-0 whitespace-nowrap">
                  {item.percent}%
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>

      {/* Row 3: 45% / 55% Grid (Business Group Dual-Axis Chart + Alert Leaderboard) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Card (5/12 -> ~42%): Composed Chart */}
        <article className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-[#0F172A]">
              各业务组毛利贡献与预算偏差
            </h2>
            <p className="text-xs text-[#64748B]">
              横向对比部门内各小组产值、实际成本与毛利率表现
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-[#475569]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#1E293B]" />
              <span>已确认产值(万)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#94A3B8]" />
              <span>实际总成本(万)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-0.5 bg-[#10B981]" />
              <span>毛利率(%)</span>
            </div>
          </div>

          {groupMetrics.length === 0 ? (
            <div className="flex-1 min-h-[280px] flex items-center justify-center text-xs text-[#64748B]">
              暂无业务组数据
            </div>
          ) : (
            <div className="w-full flex-1 min-h-[300px] pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={groupMetrics}
                  margin={{ top: 12, right: 2, left: -4, bottom: 8 }}
                  barGap={4}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#F1F5F9"
                  />
                  <XAxis
                    dataKey="group"
                    tick={{ fill: '#475569', fontSize: 11 }}
                    axisLine={{ stroke: '#E2E8F0' }}
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis
                    yAxisId="left"
                    domain={[0, groupLeftTicks[groupLeftTicks.length - 1] ?? 600]}
                    ticks={groupLeftTicks}
                    interval={0}
                    width={40}
                    tick={{ fill: '#64748B', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[
                      groupRightTicks[0] ?? 0,
                      groupRightTicks[groupRightTicks.length - 1] ?? 45,
                    ]}
                    ticks={groupRightTicks}
                    interval={0}
                    width={42}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fill: '#10B981', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: '#F8FAFC' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const g = payload[0].payload;
                      return (
                        <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs tabular-nums min-w-[180px]">
                          <div className="font-semibold text-[#0F172A] mb-1.5">
                            {g.group} ({g.projectCount}个项目)
                          </div>
                          <div className="flex flex-col gap-1">
                            <div className="flex justify-between gap-4">
                              <span className="text-[#64748B]">已确认产值</span>
                              <span className="font-medium text-[#0F172A]">
                                ¥{g.recognizedRevenue.toFixed(1)}万
                              </span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-[#64748B]">实际总成本</span>
                              <span className="font-medium text-[#475569]">
                                ¥{g.actualCost.toFixed(1)}万
                              </span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-[#64748B]">综合毛利率</span>
                              <span
                                className={`font-semibold ${
                                  g.grossMargin < 32
                                    ? 'text-[#F59E0B]'
                                    : 'text-[#10B981]'
                                }`}
                              >
                                {g.grossMargin.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="recognizedRevenue"
                    name="已确认产值(万)"
                    fill="#1E293B"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={24}
                    isAnimationActive={false}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="actualCost"
                    name="实际总成本(万)"
                    fill="#94A3B8"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={24}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="grossMargin"
                    name="毛利率(%)"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#FFFFFF', stroke: '#10B981', strokeWidth: 2 }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>

        {/* Right Card (7/12 -> ~58%): Alert Leaderboard */}
        <article className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] shrink-0" />
                <h2 className="text-base font-semibold text-[#0F172A]">
                  重点关注：预算偏差与回款滞后预警榜
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('ledger')}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>查看全部台账</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-[#64748B]">
              自动筛选「超预算 / 消耗率超进度10%」或「账期逾60天」项目，点击可穿透核查明细
            </p>
          </div>

          <div className="flex flex-col gap-3 flex-1">
            {alertProjects.length === 0 ? (
              <div className="flex-1 min-h-[180px] rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center p-6">
                <span className="text-sm font-medium text-[#10B981]">
                  当前筛选范围内所有项目预算与回款健康
                </span>
                <span className="text-xs text-[#64748B] mt-1">
                  暂无超支或逾期超过 60 天的异常预警项目
                </span>
              </div>
            ) : (
              alertProjects.map((p) => {
                const isOverrun = p.metrics.healthStatus === '超支';
                return (
                  <div
                    key={p.id}
                    className="rounded-xl border border-slate-200/90 bg-white px-4 py-3.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 hover:border-[#2563EB]/60 transition-colors"
                  >
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                            isOverrun
                              ? 'bg-[#FEF2F2] text-[#B91C1C]'
                              : 'bg-[#FFFBEB] text-[#B45309]'
                          }`}
                        >
                          {isOverrun ? '超支预警' : '回款滞后'}
                        </span>
                        <span className="text-sm font-semibold text-[#0F172A] truncate">
                          {p.name}
                        </span>
                        <span className="text-xs text-[#64748B] whitespace-nowrap">
                          {p.businessGroup} · {p.manager}
                        </span>
                      </div>
                      <p className="text-xs text-[#475569] tabular-nums leading-relaxed">
                        {p.metrics.diagnosticNotes.join('；')}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onInspectProject(p.id)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <span>穿透核查</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </article>
      </section>

      <KpiTrendModal
        metricId={activeTrendMetric}
        trendConfig={activeTrendConfig}
        projectCount={summary.projectCount}
        onSelectMetric={setActiveTrendMetric}
        onClose={() => setActiveTrendMetric(null)}
      />
    </div>
  );
};
