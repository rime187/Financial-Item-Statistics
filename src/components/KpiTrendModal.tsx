import React, { useId, useRef } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  FileText,
  PieChart as PieChartIcon,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TabId } from '../types';
import {
  formatKpiDelta,
  formatKpiValue,
  KpiMetricId,
  KpiTrendConfig,
} from '../utils/kpiTrends';
import { ModalDialog } from './ModalDialog';

interface KpiTrendModalProps {
  metricId: KpiMetricId | null;
  trendConfig: KpiTrendConfig | null;
  projectCount: number;
  onSelectMetric: (id: KpiMetricId) => void;
  onQuickNavigate?: (tab: TabId) => void;
  onClose: () => void;
}

const METRIC_TABS: Array<{ id: KpiMetricId; label: string }> = [
  { id: 'contract', label: '立项合同总额' },
  { id: 'budgetRate', label: '预算消耗率' },
  { id: 'grossMargin', label: '确认收入毛利率' },
  { id: 'collectionRate', label: '回款率 & 应收' },
  { id: 'alertCount', label: '异常预警项目' },
];

function renderMetricIcon(id: KpiMetricId) {
  switch (id) {
    case 'contract':
      return <FileText className="w-4 h-4" aria-hidden="true" />;
    case 'budgetRate':
      return <PieChartIcon className="w-4 h-4" aria-hidden="true" />;
    case 'grossMargin':
      return <TrendingUp className="w-4 h-4" aria-hidden="true" />;
    case 'collectionRate':
      return <Wallet className="w-4 h-4" aria-hidden="true" />;
    case 'alertCount':
      return <AlertTriangle className="w-4 h-4" aria-hidden="true" />;
  }
}

export const KpiTrendModal: React.FC<KpiTrendModalProps> = ({
  metricId,
  trendConfig,
  projectCount,
  onSelectMetric,
  onQuickNavigate,
  onClose,
}) => {
  const gradientId = useId();
  const titleId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const lastConfigRef = useRef<KpiTrendConfig | null>(trendConfig);

  if (trendConfig) {
    lastConfigRef.current = trendConfig;
  }

  const displayConfig = trendConfig ?? lastConfigRef.current;
  const isOpen = metricId !== null && trendConfig !== null;

  const formatYAxisTick = (val: number) => {
    if (!displayConfig) return String(val);
    if (displayConfig.valueType === 'percent') return `${val}%`;
    return `${val}`;
  };

  const handleTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    idx: number
  ) => {
    let nextIdx: number | null = null;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % METRIC_TABS.length;
    else if (e.key === 'ArrowLeft')
      nextIdx = (idx - 1 + METRIC_TABS.length) % METRIC_TABS.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = METRIC_TABS.length - 1;

    if (nextIdx !== null) {
      e.preventDefault();
      onSelectMetric(METRIC_TABS[nextIdx].id);
      tabRefs.current[nextIdx]?.focus();
    }
  };

  const quickNavTarget: { label: string; tab: TabId } | null =
    displayConfig?.id === 'collectionRate'
      ? { label: '前往回款与账龄明细', tab: 'receivables' }
      : displayConfig?.id === 'budgetRate'
        ? { label: '前往 EAC 完工测算', tab: 'eac' }
        : displayConfig?.id === 'alertCount' || displayConfig?.id === 'contract'
          ? { label: '查看项目财务台账', tab: 'ledger' }
          : null;

  const momBadgeClass = !displayConfig
    ? ''
    : displayConfig.momDelta === 0
      ? 'text-[#64748B] bg-slate-100'
      : displayConfig.isMomPositive
        ? 'text-[#059669] bg-[#ECFDF5]'
        : 'text-[#DC2626] bg-[#FEF2F2]';

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      variant="modal"
      maxWidth="700px"
      ariaLabelledBy={titleId}
      closedBy="any"
    >
      {displayConfig && (
        <>
          {/* Header */}
          <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-start justify-between gap-4 shrink-0">
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{
                  backgroundColor: displayConfig.softBg,
                  color: displayConfig.accentColor,
                }}
              >
                {renderMetricIcon(displayConfig.id)}
              </div>
              <div>
                <h1
                  id={titleId}
                  className="text-base font-bold text-[#0F172A] tracking-tight"
                >
                  {displayConfig.title} · 近 6 个月波动趋势
                </h1>
                <p className="text-xs text-[#64748B] mt-0.5">
                  {displayConfig.subtitle}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="关闭趋势图"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {/* Quick Metric Switcher */}
          <div
            role="tablist"
            aria-label="切换 KPI 趋势指标"
            className="px-6 py-2.5 bg-slate-50/70 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto shrink-0"
          >
            {METRIC_TABS.map((tab, idx) => {
              const active = tab.id === displayConfig.id;
              return (
                <button
                  key={tab.id}
                  ref={(el) => {
                    tabRefs.current[idx] = el;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  tabIndex={active ? 0 : -1}
                  onClick={() => onSelectMetric(tab.id)}
                  onKeyDown={(e) => handleTabKeyDown(e, idx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#0F172A] text-white shadow-xs'
                      : 'text-[#475569] hover:text-[#0F172A] hover:bg-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto panel-scroll flex flex-col gap-5">
            {/* 4-column Key Stat Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200/75 bg-slate-50/50 px-3.5 py-2.5">
                <span className="text-[11px] font-medium text-[#64748B]">
                  当前值 (11月实时)
                </span>
                <p
                  className="mt-1 text-lg font-bold tracking-tight tabular-nums"
                  style={{ color: displayConfig.accentColor }}
                >
                  {displayConfig.currentFormatted}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200/75 bg-slate-50/50 px-3.5 py-2.5">
                <span className="text-[11px] font-medium text-[#64748B]">
                  环比上月变化
                </span>
                <div className="mt-1.5 flex items-center">
                  <span
                    className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs font-semibold tabular-nums ${momBadgeClass}`}
                  >
                    {displayConfig.momDelta > 0 ? (
                      <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : displayConfig.momDelta < 0 ? (
                      <ArrowDownRight className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : null}
                    {displayConfig.momFormatted}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/75 bg-slate-50/50 px-3.5 py-2.5">
                <span className="text-[11px] font-medium text-[#64748B]">
                  近 6 月峰值
                </span>
                <p className="mt-1 text-lg font-bold tracking-tight text-[#0F172A] tabular-nums">
                  {displayConfig.periodHighFormatted}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200/75 bg-slate-50/50 px-3.5 py-2.5">
                <span className="text-[11px] font-medium text-[#64748B]">
                  近 6 月均值
                </span>
                <p className="mt-1 text-lg font-bold tracking-tight text-[#0F172A] tabular-nums">
                  {displayConfig.periodAvgFormatted}
                </p>
              </div>
            </div>

            {/* 6-Month Area/Line Chart */}
            <div className="rounded-xl border border-slate-200/75 bg-white p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xs font-medium text-[#475569]">
                  月度波动曲线 (2026年06月 — 2026年11月)
                </span>
                <span className="text-[11px] text-[#64748B] tabular-nums">
                  单位：{displayConfig.unit}
                </span>
              </div>

              <div className="w-full h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={displayConfig.points}
                    margin={{ top: 14, right: 16, left: 4, bottom: 4 }}
                  >
                    <defs>
                      <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor={displayConfig.accentColor}
                          stopOpacity={0.22}
                        />
                        <stop
                          offset="95%"
                          stopColor={displayConfig.accentColor}
                          stopOpacity={0.01}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#F1F5F9"
                    />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: '#475569', fontSize: 12 }}
                      axisLine={{ stroke: '#E2E8F0' }}
                      tickLine={false}
                      dy={6}
                    />
                    <YAxis
                      domain={displayConfig.yDomain}
                      ticks={displayConfig.yTicks}
                      interval={0}
                      width={46}
                      tickFormatter={formatYAxisTick}
                      tick={{ fill: '#64748B', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    {displayConfig.targetValue !== undefined && (
                      <ReferenceLine
                        y={displayConfig.targetValue}
                        stroke="#94A3B8"
                        strokeDasharray="4 4"
                        label={{
                          value: displayConfig.targetLabel,
                          position: 'insideTopRight',
                          fill: '#64748B',
                          fontSize: 11,
                        }}
                      />
                    )}
                    <Tooltip
                      cursor={{
                        stroke: '#CBD5E1',
                        strokeWidth: 1,
                        strokeDasharray: '3 3',
                      }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const pt = payload[0].payload as {
                          fullMonth: string;
                          value: number;
                          momDelta: number | null;
                        };
                        return (
                          <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs min-w-[168px] tabular-nums">
                            <div className="font-semibold text-[#0F172A] mb-1.5">
                              {pt.fullMonth}
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-[#64748B]">
                                {displayConfig.title}
                              </span>
                              <span
                                className="font-bold"
                                style={{ color: displayConfig.accentColor }}
                              >
                                {formatKpiValue(pt.value, displayConfig.valueType)}
                              </span>
                            </div>
                            {pt.momDelta !== null && (
                              <div className="flex items-center justify-between gap-4 mt-1 pt-1 border-t border-slate-100">
                                <span className="text-[#64748B]">环比变化</span>
                                <span className="font-medium text-[#334155]">
                                  {formatKpiDelta(
                                    pt.momDelta,
                                    displayConfig.valueType
                                  )}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={displayConfig.accentColor}
                      strokeWidth={2.5}
                      fill={`url(#${gradientId})`}
                      dot={{
                        r: 4,
                        fill: '#FFFFFF',
                        stroke: displayConfig.accentColor,
                        strokeWidth: 2,
                      }}
                      activeDot={{
                        r: 6,
                        fill: displayConfig.accentColor,
                        stroke: '#FFFFFF',
                        strokeWidth: 2,
                      }}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 bg-slate-50/70 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-[11px] text-[#64748B] shrink-0">
            <span>
              口径：覆盖 {projectCount} 个项目 · 11月锚定实时台账，6~10月为组合基线推演趋势
            </span>
            <div className="flex items-center gap-2">
              {quickNavTarget && onQuickNavigate && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onQuickNavigate(quickNavTarget.tab);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#EFF6FF] hover:bg-blue-100 text-[#2563EB] text-xs font-medium transition-colors cursor-pointer"
                >
                  <span>{quickNavTarget.label}</span>
                  <ArrowRight className="w-3 h-3" aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1 rounded-lg border border-slate-200 bg-white text-xs font-medium text-[#334155] hover:bg-slate-50 transition-colors cursor-pointer"
              >
                关闭
              </button>
            </div>
          </div>
        </>
      )}
    </ModalDialog>
  );
};
