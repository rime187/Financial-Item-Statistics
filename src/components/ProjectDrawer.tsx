import React, { useEffect, useState } from 'react';
import {
  Check,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  CATEGORY_COLORS,
  COST_CATEGORIES,
  CostCategory,
  CostVoucher,
  EnrichedProject,
  PROJECT_STAGES,
  ProjectStage,
  VOUCHER_SOURCES,
  VoucherSource,
} from '../types';
import { validateVoucherForm } from '../utils/projectOps';

interface ProjectDrawerProps {
  project: EnrichedProject | null;
  onClose: () => void;
  onEditProject: (project: EnrichedProject) => void;
  onRequestDeleteProject: (project: EnrichedProject) => void;
  onUpdateProjectMeta: (
    projectId: string,
    patch: { progress?: number; approvedBudget?: number; stage?: ProjectStage }
  ) => void;
  onAddVoucher: (projectId: string, voucher: Omit<CostVoucher, 'id'>) => void;
  onUpdateVoucher: (
    projectId: string,
    voucherId: string,
    voucher: Omit<CostVoucher, 'id'>
  ) => void;
  onDeleteVoucher: (projectId: string, voucherId: string) => void;
}

export const ProjectDrawer: React.FC<ProjectDrawerProps> = ({
  project,
  onClose,
  onEditProject,
  onRequestDeleteProject,
  onUpdateProjectMeta,
  onAddVoucher,
  onUpdateVoucher,
  onDeleteVoucher,
}) => {
  // Add voucher form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [voucherNo, setVoucherNo] = useState('');
  const [category, setCategory] = useState<CostCategory>('人工工时');
  const [source, setSource] = useState<VoucherSource>('ERP');
  const [amountExclTax, setAmountExclTax] = useState('');
  const [taxRate, setTaxRate] = useState('6');
  const [summary, setSummary] = useState('');
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});

  // Inline edit voucher state
  const [editingVoucherId, setEditingVoucherId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editVoucherNo, setEditVoucherNo] = useState('');
  const [editCategory, setEditCategory] = useState<CostCategory>('人工工时');
  const [editSource, setEditSource] = useState<VoucherSource>('ERP');
  const [editAmount, setEditAmount] = useState('');
  const [editTaxRate, setEditTaxRate] = useState('0');
  const [editSummary, setEditSummary] = useState('');
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  // Inline confirm delete voucher popover state
  const [confirmDeleteVoucherId, setConfirmDeleteVoucherId] = useState<
    string | null
  >(null);

  // Quick-edit budget local input to allow clean typing without snapping mid-keystroke
  const [budgetDraft, setBudgetDraft] = useState('');
  const [budgetError, setBudgetError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingVoucherId) {
          setEditingVoucherId(null);
        } else {
          onClose();
        }
      }
    };
    if (project) {
      window.addEventListener('keydown', onKeyDown);
    }
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [project, editingVoucherId, onClose]);

  useEffect(() => {
    setShowAddForm(false);
    setEditingVoucherId(null);
    setConfirmDeleteVoucherId(null);
    setAddErrors({});
    setEditErrors({});
    setVoucherNo(
      `PZ-${new Date().toISOString().slice(2, 7).replace('-', '')}-${String(
        Math.floor(100 + Math.random() * 899)
      )}`
    );
    setAmountExclTax('');
    setSummary('');
  }, [project?.id]);

  useEffect(() => {
    if (project) {
      setBudgetDraft(String(project.approvedBudget));
      setBudgetError(null);
    }
  }, [project?.id, project?.approvedBudget]);

  if (!project) return null;

  const { metrics } = project;
  const totalCost = metrics.actualCost || 1;
  const categoryItems: { label: CostCategory; value: number; color: string }[] = [
    {
      label: '人工工时',
      value: metrics.categoryCosts.labor,
      color: CATEGORY_COLORS['人工工时'],
    },
    {
      label: '软硬件采购',
      value: metrics.categoryCosts.procurement,
      color: CATEGORY_COLORS['软硬件采购'],
    },
    {
      label: '外包技术',
      value: metrics.categoryCosts.outsourcing,
      color: CATEGORY_COLORS['外包技术'],
    },
    {
      label: '差旅实施',
      value: metrics.categoryCosts.travel,
      color: CATEGORY_COLORS['差旅实施'],
    },
  ];

  const handleBudgetChange = (raw: string) => {
    setBudgetDraft(raw);
    const val = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(val) || val < 1) {
      setBudgetError('预算须 ≥ 1 万');
      return;
    }
    setBudgetError(null);
    onUpdateProjectMeta(project.id, { approvedBudget: val });
  };

  const handleSubmitVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateVoucherForm({
      date,
      voucherNo,
      category,
      source,
      amountExclTax,
      taxRate,
      summary,
    });
    if (!validation.valid) {
      setAddErrors(validation.errors);
      return;
    }

    onAddVoucher(project.id, {
      date: date.trim(),
      voucherNo: voucherNo.trim(),
      category,
      source,
      amountExclTax: Number(amountExclTax),
      taxRate: Number(taxRate) || 0,
      summary: summary.trim(),
    });

    setAddErrors({});
    setAmountExclTax('');
    setSummary('');
    setVoucherNo(
      `PZ-${new Date().toISOString().slice(2, 7).replace('-', '')}-${String(
        Math.floor(100 + Math.random() * 899)
      )}`
    );
    setShowAddForm(false);
  };

  const startEditVoucher = (v: CostVoucher) => {
    setConfirmDeleteVoucherId(null);
    setEditingVoucherId(v.id);
    setEditDate(v.date);
    setEditVoucherNo(v.voucherNo);
    setEditCategory(v.category);
    setEditSource(v.source);
    setEditAmount(String(v.amountExclTax));
    setEditTaxRate(String(v.taxRate));
    setEditSummary(v.summary);
    setEditErrors({});
  };

  const handleSaveEditVoucher = (e: React.FormEvent, voucherId: string) => {
    e.preventDefault();
    const validation = validateVoucherForm({
      date: editDate,
      voucherNo: editVoucherNo,
      category: editCategory,
      source: editSource,
      amountExclTax: editAmount,
      taxRate: editTaxRate,
      summary: editSummary,
    });
    if (!validation.valid) {
      setEditErrors(validation.errors);
      return;
    }

    onUpdateVoucher(project.id, voucherId, {
      date: editDate.trim(),
      voucherNo: editVoucherNo.trim(),
      category: editCategory,
      source: editSource,
      amountExclTax: Number(editAmount),
      taxRate: Number(editTaxRate) || 0,
      summary: editSummary.trim(),
    });
    setEditingVoucherId(null);
    setEditErrors({});
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-[1px]">
      <div className="flex-1" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="项目穿透核查抽屉"
        className="w-full sm:w-[580px] h-full bg-white border-l border-slate-200 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-3 shrink-0">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-[#0F172A] truncate">
                {project.name}
              </h2>
              <span
                className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                  metrics.healthStatus === '超支'
                    ? 'bg-[#FEF2F2] text-[#B91C1C]'
                    : metrics.healthStatus === '回款滞后'
                    ? 'bg-[#FFFBEB] text-[#B45309]'
                    : 'bg-[#ECFDF5] text-[#047857]'
                }`}
              >
                {metrics.healthStatus}
              </span>
            </div>
            <p className="text-xs text-[#64748B] tabular-nums">
              {project.code} · {project.businessGroup} · 负责人：
              {project.manager} · 客户：{project.client}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onEditProject(project)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-[#334155] hover:bg-slate-50 hover:text-[#2563EB] hover:border-blue-200 transition-colors cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>编辑项目</span>
            </button>
            <button
              type="button"
              aria-label="关闭抽屉"
              onClick={onClose}
              className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-[#64748B] hover:bg-slate-100 hover:text-[#0F172A] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">
          {/* Top 5 Core Metrics Strip */}
          <div className="grid grid-cols-5 gap-2 rounded-xl bg-[#F8FAFC] border border-slate-200/80 p-3.5 text-center tabular-nums">
            <div>
              <div className="text-[11px] text-[#64748B]">合同额</div>
              <div className="text-xs font-bold text-[#0F172A] mt-0.5">
                ¥{project.contractAmount.toFixed(1)}万
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#64748B]">实际总成本</div>
              <div
                className={`text-xs font-bold mt-0.5 ${
                  metrics.isOverBudget ? 'text-[#EF4444]' : 'text-[#0F172A]'
                }`}
              >
                ¥{metrics.actualCost.toFixed(1)}万
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#64748B]">预算消耗</div>
              <div
                className={`text-xs font-bold mt-0.5 ${
                  metrics.isOverrunWarning ? 'text-[#EF4444]' : 'text-[#2563EB]'
                }`}
              >
                {metrics.budgetConsumptionRate.toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#64748B]">核算毛利率</div>
              <div
                className={`text-xs font-bold mt-0.5 ${
                  metrics.grossMargin < 32
                    ? 'text-[#F59E0B]'
                    : 'text-[#10B981]'
                }`}
              >
                {metrics.grossMargin.toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#64748B]">应收未回</div>
              <div className="text-xs font-bold text-[#0F172A] mt-0.5">
                ¥{metrics.uncollectedReceivable.toFixed(1)}万
              </div>
            </div>
          </div>

          {/* High-Frequency Quick Edit Controls */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#0F172A]">
                高频管控字段快捷调节
              </span>
              <span className="text-[11px] text-[#64748B]">
                实时同步毛利率、预算消耗率与全局图表
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
              <div className="flex flex-col gap-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[#475569]">完工进度</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      aria-label="完工进度百分比"
                      min={0}
                      max={100}
                      value={project.progress}
                      onChange={(e) => {
                        const raw = Number(e.target.value);
                        if (!Number.isFinite(raw)) return;
                        const val = Math.min(100, Math.max(0, Math.round(raw)));
                        onUpdateProjectMeta(project.id, { progress: val });
                      }}
                      className="w-14 px-1.5 py-0.5 rounded-md border border-slate-200 text-right text-xs font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
                    />
                    <span className="text-[#64748B]">%</span>
                  </div>
                </div>
                <input
                  type="range"
                  aria-label="拖动调节完工进度"
                  min={0}
                  max={100}
                  step={1}
                  value={project.progress}
                  onChange={(e) =>
                    onUpdateProjectMeta(project.id, {
                      progress: Number(e.target.value),
                    })
                  }
                  className="w-full accent-[#2563EB] cursor-pointer"
                />
              </div>

              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-[#475569]">核定总预算 (万)</span>
                <input
                  type="number"
                  min={1}
                  step="1"
                  value={budgetDraft}
                  onChange={(e) => handleBudgetChange(e.target.value)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold tabular-nums focus:outline-none focus:ring-2 ${
                    budgetError
                      ? 'border-[#EF4444] bg-[#FEF2F2]/40 focus:ring-[#EF4444]/25'
                      : 'border-slate-200 focus:ring-[#2563EB]/30 focus:border-[#2563EB]'
                  }`}
                />
                {budgetError && (
                  <span className="text-[11px] text-[#EF4444]">
                    {budgetError}
                  </span>
                )}
              </label>

              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-[#475569]">项目阶段</span>
                <select
                  value={project.stage}
                  onChange={(e) =>
                    onUpdateProjectMeta(project.id, {
                      stage: e.target.value as ProjectStage,
                    })
                  }
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
                >
                  {PROJECT_STAGES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* Middle: 4-Category Cost Proportion Bar */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[#0F172A]">
                四大成本科目占比拆解
              </h3>
              <span className="text-xs text-[#64748B] tabular-nums">
                累计发生 ¥{metrics.actualCost.toFixed(2)}万
              </span>
            </div>

            <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden flex gap-0.5">
              {categoryItems.map((c) => {
                const pct =
                  metrics.actualCost > 0 ? (c.value / totalCost) * 100 : 0;
                if (pct <= 0) return null;
                return (
                  <div
                    key={c.label}
                    title={`${c.label}: ¥${c.value.toFixed(2)}万 (${pct.toFixed(1)}%)`}
                    className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-300"
                    style={{ width: `${pct}%`, backgroundColor: c.color }}
                  />
                );
              })}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {categoryItems.map((c) => {
                const pct =
                  metrics.actualCost > 0 ? (c.value / totalCost) * 100 : 0;
                return (
                  <div
                    key={c.label}
                    className="rounded-xl bg-[#F8FAFC] border border-slate-200/70 px-3 py-2 flex flex-col gap-0.5"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: c.color }}
                      />
                      <span className="truncate">{c.label}</span>
                    </div>
                    <div className="text-xs font-bold text-[#0F172A] tabular-nums">
                      ¥{c.value.toFixed(1)}万
                    </div>
                    <div className="text-[11px] text-[#64748B] tabular-nums">
                      {pct.toFixed(1)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom: Cost Voucher Stream + Inline Entry / Edit / Confirm-Delete */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[#0F172A]">
                成本凭证明细流水 ({project.vouchers.length} 笔)
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm((prev) => !prev);
                  setAddErrors({});
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EFF6FF] text-[#2563EB] hover:bg-blue-100 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showAddForm ? '收起录入表' : '录入成本单据'}</span>
              </button>
            </div>

            {showAddForm && (
              <form
                onSubmit={handleSubmitVoucher}
                noValidate
                className="rounded-xl border border-blue-200 bg-[#F8FAFC] p-3.5 flex flex-col gap-3"
              >
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <label className="flex flex-col gap-1">
                    <span className="text-[#475569] font-medium">入账日期 *</span>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => {
                        setDate(e.target.value);
                        setAddErrors((prev) => ({ ...prev, date: '' }));
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs tabular-nums"
                    />
                    {addErrors.date && (
                      <span className="text-[11px] text-[#EF4444]">
                        {addErrors.date}
                      </span>
                    )}
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[#475569] font-medium">凭证号 *</span>
                    <input
                      type="text"
                      value={voucherNo}
                      onChange={(e) => {
                        setVoucherNo(e.target.value);
                        setAddErrors((prev) => ({ ...prev, voucherNo: '' }));
                      }}
                      placeholder="PZ-2611-099"
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs tabular-nums"
                    />
                    {addErrors.voucherNo && (
                      <span className="text-[11px] text-[#EF4444]">
                        {addErrors.voucherNo}
                      </span>
                    )}
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <label className="flex flex-col gap-1">
                    <span className="text-[#475569] font-medium">成本科目</span>
                    <select
                      value={category}
                      onChange={(e) =>
                        setCategory(e.target.value as CostCategory)
                      }
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                    >
                      {COST_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[#475569] font-medium">单据来源</span>
                    <select
                      value={source}
                      onChange={(e) =>
                        setSource(e.target.value as VoucherSource)
                      }
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                    >
                      {VOUCHER_SOURCES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <label className="flex flex-col gap-1">
                    <span className="text-[#475569] font-medium">
                      不含税金额 (万元) *
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="如 12.5"
                      value={amountExclTax}
                      onChange={(e) => {
                        setAmountExclTax(e.target.value);
                        setAddErrors((prev) => ({ ...prev, amountExclTax: '' }));
                      }}
                      className={`px-2.5 py-1.5 rounded-lg border bg-white text-xs tabular-nums ${
                        addErrors.amountExclTax
                          ? 'border-[#EF4444]'
                          : 'border-slate-200'
                      }`}
                    />
                    {addErrors.amountExclTax && (
                      <span className="text-[11px] text-[#EF4444]">
                        {addErrors.amountExclTax}
                      </span>
                    )}
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[#475569] font-medium">税率 (%)</span>
                    <select
                      value={taxRate}
                      onChange={(e) => setTaxRate(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs tabular-nums"
                    >
                      <option value="0">0% (工时/免税)</option>
                      <option value="6">6% (服务/外包)</option>
                      <option value="13">13% (软硬件采购)</option>
                    </select>
                  </label>
                </div>

                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-[#475569] font-medium">摘要说明 *</span>
                  <input
                    type="text"
                    placeholder="输入供应商或成本发生明细..."
                    value={summary}
                    onChange={(e) => {
                      setSummary(e.target.value);
                      setAddErrors((prev) => ({ ...prev, summary: '' }));
                    }}
                    className={`px-2.5 py-1.5 rounded-lg border bg-white text-xs ${
                      addErrors.summary
                        ? 'border-[#EF4444]'
                        : 'border-slate-200'
                    }`}
                  />
                  {addErrors.summary && (
                    <span className="text-[11px] text-[#EF4444]">
                      {addErrors.summary}
                    </span>
                  )}
                </label>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setAddErrors({});
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-[#475569] cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold cursor-pointer"
                  >
                    确认录入并同步重算
                  </button>
                </div>
              </form>
            )}

            <div className="flex flex-col gap-2">
              {project.vouchers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-[#64748B]">
                  暂无成本明细凭证，点击上方「录入成本单据」添加
                </div>
              ) : (
                project.vouchers.map((v) => {
                  const isEditing = editingVoucherId === v.id;
                  const isConfirmingDel = confirmDeleteVoucherId === v.id;

                  if (isEditing) {
                    return (
                      <form
                        key={v.id}
                        onSubmit={(e) => handleSaveEditVoucher(e, v.id)}
                        noValidate
                        className="rounded-xl border border-blue-300 bg-[#F8FAFC] p-3 flex flex-col gap-2.5 text-xs"
                      >
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] text-[#64748B]">
                              入账日期
                            </span>
                            <input
                              type="date"
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                              className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs tabular-nums"
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] text-[#64748B]">
                              凭证号
                            </span>
                            <input
                              type="text"
                              value={editVoucherNo}
                              onChange={(e) => setEditVoucherNo(e.target.value)}
                              className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs tabular-nums"
                            />
                            {editErrors.voucherNo && (
                              <span className="text-[11px] text-[#EF4444]">
                                {editErrors.voucherNo}
                              </span>
                            )}
                          </label>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] text-[#64748B]">
                              成本科目
                            </span>
                            <select
                              value={editCategory}
                              onChange={(e) =>
                                setEditCategory(e.target.value as CostCategory)
                              }
                              className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs"
                            >
                              {COST_CATEGORIES.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] text-[#64748B]">
                              来源
                            </span>
                            <select
                              value={editSource}
                              onChange={(e) =>
                                setEditSource(e.target.value as VoucherSource)
                              }
                              className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs"
                            >
                              {VOUCHER_SOURCES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] text-[#64748B]">
                              金额 (万元)
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              value={editAmount}
                              onChange={(e) => setEditAmount(e.target.value)}
                              className={`px-2 py-1 rounded-lg border bg-white text-xs font-semibold tabular-nums ${
                                editErrors.amountExclTax
                                  ? 'border-[#EF4444]'
                                  : 'border-slate-200'
                              }`}
                            />
                            {editErrors.amountExclTax && (
                              <span className="text-[11px] text-[#EF4444]">
                                {editErrors.amountExclTax}
                              </span>
                            )}
                          </label>
                        </div>

                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] text-[#64748B]">
                            摘要说明
                          </span>
                          <input
                            type="text"
                            value={editSummary}
                            onChange={(e) => setEditSummary(e.target.value)}
                            className={`px-2 py-1 rounded-lg border bg-white text-xs ${
                              editErrors.summary
                                ? 'border-[#EF4444]'
                                : 'border-slate-200'
                            }`}
                          />
                          {editErrors.summary && (
                            <span className="text-[11px] text-[#EF4444]">
                              {editErrors.summary}
                            </span>
                          )}
                        </label>

                        <div className="flex items-center justify-end gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingVoucherId(null);
                              setEditErrors({});
                            }}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs text-[#475569] hover:bg-slate-50 cursor-pointer"
                          >
                            取消
                          </button>
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>保存</span>
                          </button>
                        </div>
                      </form>
                    );
                  }

                  return (
                    <div
                      key={v.id}
                      className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-3 flex items-start justify-between gap-3 hover:border-slate-300 transition-colors"
                    >
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-semibold text-[#0F172A] tabular-nums">
                            {v.voucherNo}
                          </span>
                          <span className="text-[#64748B] tabular-nums">
                            {v.date}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[11px] font-medium text-[#475569]">
                            {v.source}
                          </span>
                          <span
                            className="text-[11px] font-medium"
                            style={{ color: CATEGORY_COLORS[v.category] }}
                          >
                            {v.category}
                          </span>
                        </div>
                        <p className="text-xs text-[#475569] truncate">
                          {v.summary}
                        </p>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <div className="text-right tabular-nums">
                          <div className="text-xs font-bold text-[#0F172A]">
                            ¥{v.amountExclTax.toFixed(2)}万
                          </div>
                          <div className="text-[11px] text-[#64748B]">
                            税率 {v.taxRate}%
                          </div>
                        </div>

                        {isConfirmingDel ? (
                          <div className="inline-flex items-center gap-1 rounded-lg bg-[#FEF2F2] border border-red-200 px-2 py-1">
                            <span className="text-[11px] text-[#B91C1C] font-medium">
                              确认删？
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteVoucher(project.id, v.id);
                                setConfirmDeleteVoucherId(null);
                              }}
                              className="px-1.5 py-0.5 rounded bg-[#EF4444] text-white text-[11px] font-semibold hover:bg-red-600 cursor-pointer"
                            >
                              删除
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteVoucherId(null)}
                              className="px-1.5 py-0.5 rounded bg-white text-[#475569] text-[11px] hover:bg-slate-100 cursor-pointer"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              aria-label={`编辑凭证 ${v.voucherNo}`}
                              title="行内编辑凭证"
                              onClick={() => startEditVoucher(v)}
                              className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-[#94A3B8] hover:text-[#2563EB] hover:bg-[#EFF6FF] transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label={`删除凭证 ${v.voucherNo}`}
                              title="删除凭证"
                              onClick={() => setConfirmDeleteVoucherId(v.id)}
                              className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Sticky Drawer Footer with Delete Project Action */}
        <div className="px-6 py-3.5 bg-slate-50/80 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onRequestDeleteProject(project)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-white text-xs font-medium text-[#DC2626] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>删除项目</span>
          </button>

          <span className="text-[11px] text-[#64748B]">
            变更自动保存至本地并驱动全局 4 视图重算
          </span>
        </div>
      </aside>
    </div>
  );
};
