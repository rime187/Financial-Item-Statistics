import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Calculator,
  RotateCcw,
  Sliders,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { EnrichedProject } from '../types';
import { calcPortfolioSummary, round1 } from '../utils/finance';

interface EacSandboxProps {
  projects: EnrichedProject[];
}

export const EacSandbox: React.FC<EacSandboxProps> = ({ projects }) => {
  const [selectedScope, setSelectedScope] = useState<string>('all');

  const scopeData = useMemo(() => {
    if (selectedScope === 'all') {
      const sum = calcPortfolioSummary(projects);
      const weightedProgress =
        sum.totalContract > 0
          ? (sum.totalRecognizedRevenue / sum.totalContract) * 100
          : 0;
      return {
        label: `全局部门汇总 (${sum.projectCount}个项目)`,
        contractAmount: sum.totalContract,
        bac: sum.totalBudget,
        ac: sum.totalActualCost,
        progress: round1(weightedProgress),
        laborCost: sum.categoryTotals.labor,
        procOutCost:
          sum.categoryTotals.procurement + sum.categoryTotals.outsourcing,
      };
    }
    const target = projects.find((p) => p.id === selectedScope);
    if (!target) {
      return null;
    }
    return {
      label: `${target.code} · ${target.name}`,
      contractAmount: target.contractAmount,
      bac: target.approvedBudget,
      ac: target.metrics.actualCost,
      progress: target.progress,
      laborCost: target.metrics.categoryCosts.labor,
      procOutCost:
        target.metrics.categoryCosts.procurement +
        target.metrics.categoryCosts.outsourcing,
    };
  }, [projects, selectedScope]);

  // Ensure selectedScope falls back to 'all' if filtered out
  useEffect(() => {
    if (
      selectedScope !== 'all' &&
      !projects.some((p) => p.id === selectedScope)
    ) {
      setSelectedScope('all');
    }
  }, [projects, selectedScope]);

  const [progressOverride, setProgressOverride] = useState<number>(75);
  // CPI adjustment percentage: -20% (worse efficiency) to +30% (improved efficiency)
  const [cpiAdjustPct, setCpiAdjustPct] = useState<number>(0);
  // Labor reduction % for remaining work (0% ~ 30%)
  const [laborCutPct, setLaborCutPct] = useState<number>(0);
  // Procurement & Outsourcing reduction % for remaining work (0% ~ 30%)
  const [procCutPct, setProcCutPct] = useState<number>(0);

  // Sync progress slider when scope switches
  useEffect(() => {
    if (scopeData) {
      setProgressOverride(Math.round(scopeData.progress));
      setCpiAdjustPct(0);
      setLaborCutPct(0);
      setProcCutPct(0);
    }
  }, [selectedScope, scopeData?.progress]);

  const metrics = useMemo(() => {
    if (!scopeData) {
      return {
        ev: 0,
        baseCpi: 1,
        simCpi: 1,
        baseEtc: 0,
        baseEac: 0,
        simEtc: 0,
        simEac: 0,
        vac: 0,
        finalMargin: 0,
        targetMargin: 0,
      };
    }

    const { contractAmount, bac, ac, laborCost, procOutCost } = scopeData;
    const pct = Math.min(100, Math.max(1, progressOverride));
    // Earned Value (EV) = BAC * (progress / 100)
    const ev = bac * (pct / 100);
    const baseCpi = ac > 0 ? ev / ac : 1;
    const clampedBaseCpi = Math.max(0.35, Math.min(2.5, baseCpi));

    // Baseline EAC = AC + (BAC - EV) / baseCpi
    const remainingEv = Math.max(0, bac - ev);
    const baseEtc = remainingEv / clampedBaseCpi;
    const baseEac = ac + baseEtc;

    // Sandbox adjusted CPI & category optimization
    const simCpi = Math.max(
      0.35,
      Math.min(3.0, clampedBaseCpi * (1 + cpiAdjustPct / 100))
    );
    const totalTracked = ac > 0 ? ac : 1;
    const laborWeight = Math.min(1, laborCost / totalTracked);
    const procWeight = Math.min(1 - laborWeight, procOutCost / totalTracked);
    const combinedCutFactor =
      1 -
      laborWeight * (laborCutPct / 100) -
      procWeight * (procCutPct / 100);

    const simEtc = Math.max(0, (remainingEv / simCpi) * combinedCutFactor);
    const simEac = ac + simEtc;
    const vac = bac - simEac; // Positive = under budget, Negative = overrun
    const finalMargin =
      contractAmount > 0
        ? ((contractAmount - simEac) / contractAmount) * 100
        : 0;
    const targetMargin =
      contractAmount > 0 ? ((contractAmount - bac) / contractAmount) * 100 : 0;

    return {
      ev: round1(ev),
      baseCpi,
      simCpi,
      baseEtc: round1(baseEtc),
      baseEac: round1(baseEac),
      simEtc: round1(simEtc),
      simEac: round1(simEac),
      vac: round1(vac),
      finalMargin,
      targetMargin,
    };
  }, [scopeData, progressOverride, cpiAdjustPct, laborCutPct, procCutPct]);

  const comparisonBars = useMemo(() => {
    if (!scopeData) return [];
    return [
      {
        name: '核定总预算 (BAC)',
        value: round1(scopeData.bac),
        color: '#CBD5E1',
      },
      {
        name: '已发生成本 (AC)',
        value: round1(scopeData.ac),
        color: '#3B82F6',
      },
      {
        name: '基准预测 EAC',
        value: metrics.baseEac,
        color: '#94A3B8',
      },
      {
        name: '沙盘优化 EAC',
        value: metrics.simEac,
        color: metrics.simEac > scopeData.bac ? '#EF4444' : '#10B981',
      },
    ];
  }, [scopeData, metrics]);

  const handleResetSandbox = () => {
    if (scopeData) {
      setProgressOverride(Math.round(scopeData.progress));
    }
    setCpiAdjustPct(0);
    setLaborCutPct(0);
    setProcCutPct(0);
  };

  if (!scopeData) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center text-sm text-[#64748B]">
        当前筛选条件下暂无可测算项目
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Top Scope Selector Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-[#0F172A]">
            EAC 测算对象
          </span>
          <select
            aria-label="选择测算范围"
            value={selectedScope}
            onChange={(e) => setSelectedScope(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-[#F8FAFC] border border-slate-200 text-xs font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] cursor-pointer"
          >
            <option value="all">
              全局部门测算 (当前筛选 {projects.length} 个项目)
            </option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} · {p.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handleResetSandbox}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-[#475569] hover:bg-slate-50 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>恢复基准参数</span>
        </button>
      </div>

      {/* Top 4 Forecast Metric Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
        <article className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-5 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-medium text-[#475569]">
              成本绩效指数 (CPI)
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#EEF2FF] text-[#6366F1] flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <p
              className={`text-[28px] leading-9 font-bold tabular-nums ${
                metrics.simCpi < 1 ? 'text-[#EF4444]' : 'text-[#047857]'
              }`}
            >
              {metrics.simCpi.toFixed(2)}
            </p>
            <span className="text-xs text-[#64748B] tabular-nums">
              当前实际 CPI {metrics.baseCpi.toFixed(2)} (≥1.00 为受控)
            </span>
          </div>
        </article>

        <article className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-5 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-medium text-[#475569]">
              完工尚需估算 (ETC)
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center shrink-0">
              <Calculator className="w-4 h-4" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[28px] leading-9 font-bold text-[#0F172A] tabular-nums">
              ¥{metrics.simEtc.toFixed(1)}万
            </p>
            <span className="text-xs text-[#64748B] tabular-nums">
              基准未优化 ETC ¥{metrics.baseEtc.toFixed(1)}万
            </span>
          </div>
        </article>

        <article className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-5 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-medium text-[#475569]">
              完工总成本估算 (EAC) & VAC
            </span>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                metrics.vac < 0
                  ? 'bg-[#FEF2F2] text-[#EF4444]'
                  : 'bg-[#ECFDF5] text-[#10B981]'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <p
              className={`text-[28px] leading-9 font-bold tabular-nums ${
                metrics.vac < 0 ? 'text-[#B91C1C]' : 'text-[#047857]'
              }`}
            >
              ¥{metrics.simEac.toFixed(1)}万
            </p>
            <span
              className={`text-xs font-medium tabular-nums ${
                metrics.vac < 0 ? 'text-[#EF4444]' : 'text-[#10B981]'
              }`}
            >
              VAC 偏差：{metrics.vac >= 0 ? '节余 +' : '超支 '}
              ¥{Math.abs(metrics.vac).toFixed(1)}万 (BAC ¥
              {scopeData.bac.toFixed(1)}万)
            </span>
          </div>
        </article>

        <article className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-5 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-medium text-[#475569]">
              预计最终完工毛利率
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#FFFBEB] text-[#F59E0B] flex items-center justify-center shrink-0">
              <Sliders className="w-4 h-4" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <p
              className={`text-[28px] leading-9 font-bold tabular-nums ${
                metrics.finalMargin < 32 ? 'text-[#F59E0B]' : 'text-[#10B981]'
              }`}
            >
              {metrics.finalMargin.toFixed(1)}%
            </p>
            <span className="text-xs text-[#64748B] tabular-nums">
              立项目标毛利率 {metrics.targetMargin.toFixed(1)}% (合同 ¥
              {scopeData.contractAmount.toFixed(1)}万)
            </span>
          </div>
        </article>
      </section>

      {/* Interactive Split: Left Sliders + Right BarChart Comparison */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Interactive Console (5/12) */}
        <article className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-6 flex flex-col justify-between gap-5">
          <div>
            <h2 className="text-base font-semibold text-[#0F172A]">
              沙盘参数交互控制台
            </h2>
            <p className="text-xs text-[#64748B] mt-1">
              调节进度校准、剩余效率 CPI 与重点科目压降比例，实时模拟纠偏效果
            </p>
          </div>

          <div className="flex flex-col gap-5">
            {/* Control 1: Progress Calibration */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[#0F172A]">
                  完工进度校准 (%)
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={progressOverride}
                    onChange={(e) =>
                      setProgressOverride(
                        Math.min(100, Math.max(1, Number(e.target.value) || 1))
                      )
                    }
                    className="w-16 px-2 py-1 rounded border border-slate-200 text-right text-xs font-semibold tabular-nums text-[#2563EB] focus:outline-none focus:border-[#2563EB]"
                  />
                  <span className="text-[#64748B]">%</span>
                </div>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                value={progressOverride}
                onChange={(e) => setProgressOverride(Number(e.target.value))}
                className="w-full accent-[#2563EB] cursor-pointer"
              />
            </div>

            {/* Control 2: CPI Adjustment */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[#0F172A]">
                  剩余工作成本效率系数 CPI 微调
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={-20}
                    max={30}
                    value={cpiAdjustPct}
                    onChange={(e) =>
                      setCpiAdjustPct(
                        Math.min(30, Math.max(-20, Number(e.target.value) || 0))
                      )
                    }
                    className="w-16 px-2 py-1 rounded border border-slate-200 text-right text-xs font-semibold tabular-nums text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                  />
                  <span className="text-[#64748B]">%</span>
                </div>
              </div>
              <input
                type="range"
                min={-20}
                max={30}
                value={cpiAdjustPct}
                onChange={(e) => setCpiAdjustPct(Number(e.target.value))}
                className="w-full accent-[#2563EB] cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-[#64748B] tabular-nums">
                <span>-20% (恶化超支)</span>
                <span>0% (按当前CPI {metrics.baseCpi.toFixed(2)})</span>
                <span>+30% (效率提升)</span>
              </div>
            </div>

            {/* Control 3: Labor Cut */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[#0F172A]">
                  人工工时压降模拟 (%)
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={laborCutPct}
                    onChange={(e) =>
                      setLaborCutPct(
                        Math.min(30, Math.max(0, Number(e.target.value) || 0))
                      )
                    }
                    className="w-16 px-2 py-1 rounded border border-slate-200 text-right text-xs font-semibold tabular-nums text-[#10B981] focus:outline-none focus:border-[#2563EB]"
                  />
                  <span className="text-[#64748B]">%</span>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={30}
                value={laborCutPct}
                onChange={(e) => setLaborCutPct(Number(e.target.value))}
                className="w-full accent-[#10B981] cursor-pointer"
              />
            </div>

            {/* Control 4: Procurement & Outsourcing Cut */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[#0F172A]">
                  采购 / 外包压降模拟 (%)
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={procCutPct}
                    onChange={(e) =>
                      setProcCutPct(
                        Math.min(30, Math.max(0, Number(e.target.value) || 0))
                      )
                    }
                    className="w-16 px-2 py-1 rounded border border-slate-200 text-right text-xs font-semibold tabular-nums text-[#6366F1] focus:outline-none focus:border-[#2563EB]"
                  />
                  <span className="text-[#64748B]">%</span>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={30}
                value={procCutPct}
                onChange={(e) => setProcCutPct(Number(e.target.value))}
                className="w-full accent-[#6366F1] cursor-pointer"
              />
            </div>
          </div>

          <div className="rounded-xl bg-[#EFF6FF] border border-blue-100 p-3.5 text-xs text-[#1E3A8A] leading-relaxed tabular-nums">
            <span className="font-semibold text-[#1D4ED8] block mb-0.5">
              测算诊断结论
            </span>
            对比基准预测 EAC (¥{metrics.baseEac.toFixed(1)}万)，当前沙盘参数可
            {metrics.baseEac - metrics.simEac >= 0 ? '节约成本 ' : '增加成本 '}
            <strong className="font-semibold">
              ¥{Math.abs(metrics.baseEac - metrics.simEac).toFixed(1)}万
            </strong>
            ，预计完工总成本 ¥{metrics.simEac.toFixed(1)}万，最终毛利率{' '}
            <strong className="font-semibold">
              {metrics.finalMargin.toFixed(1)}%
            </strong>
            。
          </div>
        </article>

        {/* Right Visualization Comparison (7/12) */}
        <article className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-6 flex flex-col justify-between gap-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-[#0F172A]">
                核定预算 vs 基准预测 vs 沙盘优化 EAC 对比
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                测算范围：{scopeData.label}
              </p>
            </div>
            <span className="text-xs text-[#64748B]">单位：万元 (RMB)</span>
          </div>

          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={comparisonBars}
                margin={{ top: 16, right: 16, left: -8, bottom: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#F1F5F9"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#475569', fontSize: 12 }}
                  axisLine={{ stroke: '#E2E8F0' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#64748B', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: '#F8FAFC' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const item = payload[0].payload;
                    return (
                      <div className="bg-white border border-slate-200 rounded-lg shadow-md px-3 py-2 text-xs tabular-nums">
                        <div className="font-semibold text-[#0F172A]">
                          {item.name}
                        </div>
                        <div className="text-[#475569] mt-0.5">
                          ¥{item.value.toFixed(1)}万
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={64}>
                  {comparisonBars.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs tabular-nums">
            {comparisonBars.map((b) => (
              <div
                key={b.name}
                className="rounded-xl bg-[#F8FAFC] border border-slate-200/70 px-3 py-2.5"
              >
                <div className="flex items-center gap-1.5 text-[#64748B]">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: b.color }}
                  />
                  <span className="truncate">{b.name}</span>
                </div>
                <div className="text-sm font-bold text-[#0F172A] mt-1">
                  ¥{b.value.toFixed(1)}万
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
};
