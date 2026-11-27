import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Hourglass,
  Pencil,
  Plus,
  Receipt,
  Search,
  Sparkles,
  Trash2,
  Wallet,
  X,
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
import {
  EnrichedProject,
  PaymentRecord,
  PaymentRecordType,
} from '../types';
import {
  calcAgingDistribution,
  calcBusinessGroupMetrics,
  calcPortfolioSummary,
} from '../utils/finance';
import { validatePaymentRecordForm } from '../utils/projectOps';
import { ModalDialog } from './ModalDialog';

interface ReceivablesAgingProps {
  projects: EnrichedProject[];
  initialModalProjectId?: string | null;
  onClearInitialModalProject?: () => void;
  onAddPaymentRecord: (
    projectId: string,
    record: Omit<PaymentRecord, 'id'>
  ) => void;
  onUpdatePaymentRecord: (
    projectId: string,
    recordId: string,
    record: Omit<PaymentRecord, 'id'>
  ) => void;
  onDeletePaymentRecord: (projectId: string, recordId: string) => void;
  onUpdateOverdueDays: (projectId: string, maxOverdueDays: number) => void;
}

const PAYMENT_FIELD_ORDER = ['date', 'amount', 'voucherNo', 'note'];

function matchesAgingBucket(p: EnrichedProject, bucket: string): boolean {
  if (p.metrics.uncollectedReceivable <= 0) return false;
  if (bucket === '0-30天') return p.maxOverdueDays <= 30;
  if (bucket === '31-60天') return p.maxOverdueDays > 30 && p.maxOverdueDays <= 60;
  if (bucket === '61-90天') return p.maxOverdueDays > 60 && p.maxOverdueDays <= 90;
  if (bucket === '90天以上') return p.maxOverdueDays > 90;
  return true;
}

export const ReceivablesAging: React.FC<ReceivablesAgingProps> = ({
  projects,
  initialModalProjectId,
  onClearInitialModalProject,
  onAddPaymentRecord,
  onUpdatePaymentRecord,
  onDeletePaymentRecord,
  onUpdateOverdueDays,
}) => {
  const captionId = useId();
  const modalTitleId = useId();
  const baseId = useId();
  const addFormRef = useRef<HTMLFormElement>(null);
  const editFormRef = useRef<HTMLFormElement>(null);

  const summary = useMemo(() => calcPortfolioSummary(projects), [projects]);
  const agingBuckets = useMemo(
    () => calcAgingDistribution(projects),
    [projects]
  );
  const groupRankings = useMemo(
    () =>
      [...calcBusinessGroupMetrics(projects)].sort(
        (a, b) => b.collectionRate - a.collectionRate
      ),
    [projects]
  );

  // Interactive table filters
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [onlyUncollected, setOnlyUncollected] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const sortedProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...projects]
      .filter((p) => {
        if (selectedBucket && !matchesAgingBucket(p, selectedBucket)) {
          return false;
        }
        if (onlyUncollected && p.metrics.uncollectedReceivable <= 0) {
          return false;
        }
        if (q) {
          return (
            p.name.toLowerCase().includes(q) ||
            p.code.toLowerCase().includes(q) ||
            p.client.toLowerCase().includes(q) ||
            p.milestone.toLowerCase().includes(q) ||
            p.businessGroup.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (b.maxOverdueDays !== a.maxOverdueDays) {
          return b.maxOverdueDays - a.maxOverdueDays;
        }
        return b.metrics.uncollectedReceivable - a.metrics.uncollectedReceivable;
      });
  }, [projects, selectedBucket, onlyUncollected, searchQuery]);

  const uncollectedProjectsCount = useMemo(
    () => projects.filter((p) => p.metrics.uncollectedReceivable > 0).length,
    [projects]
  );

  // Payment Record Management Modal state
  const [modalProjectId, setModalProjectId] = useState<string | null>(null);
  const [overdueDraft, setOverdueDraft] = useState('0');
  const [overdueError, setOverdueError] = useState<string | null>(null);

  // Add payment record form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newType, setNewType] = useState<PaymentRecordType>('回款');
  const [newDate, setNewDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [newAmount, setNewAmount] = useState('');
  const [newVoucherNo, setNewVoucherNo] = useState('');
  const [newNote, setNewNote] = useState('');
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});

  // Inline edit payment record
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editType, setEditType] = useState<PaymentRecordType>('回款');
  const [editDate, setEditDate] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editVoucherNo, setEditVoucherNo] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  // Inline confirm delete record
  const [confirmDeleteRecordId, setConfirmDeleteRecordId] = useState<
    string | null
  >(null);

  const activeModalProject = useMemo(
    () => projects.find((p) => p.id === modalProjectId) ?? null,
    [projects, modalProjectId]
  );

  const lastModalProjectRef = useRef<EnrichedProject | null>(activeModalProject);
  if (activeModalProject) {
    lastModalProjectRef.current = activeModalProject;
  }
  const displayModalProject = activeModalProject ?? lastModalProjectRef.current;

  const openModal = (p: EnrichedProject) => {
    setModalProjectId(p.id);
    setOverdueDraft(String(p.maxOverdueDays));
    setOverdueError(null);
    setShowAddForm(false);
    setEditingRecordId(null);
    setConfirmDeleteRecordId(null);
    setAddErrors({});
    setEditErrors({});
    setNewType('回款');
    setNewDate(new Date().toISOString().slice(0, 10));
    setNewAmount(
      p.metrics.uncollectedReceivable > 0
        ? String(p.metrics.uncollectedReceivable)
        : ''
    );
    setNewVoucherNo(
      `HK-${new Date().toISOString().slice(2, 7).replace('-', '')}-${String(
        Math.floor(100 + Math.random() * 899)
      )}`
    );
    setNewNote(`${p.milestone}回款到账`);
  };

  // Handle cross-tab jump from ProjectDrawer directly into a project's payment modal
  useEffect(() => {
    if (!initialModalProjectId) return;
    const target = projects.find((p) => p.id === initialModalProjectId);
    if (target) {
      openModal(target);
    }
    onClearInitialModalProject?.();
  }, [initialModalProjectId, projects, onClearInitialModalProject]);

  useEffect(() => {
    if (!activeModalProject) return;
    setOverdueDraft(String(activeModalProject.maxOverdueDays));
    setOverdueError(null);
  }, [activeModalProject?.id, activeModalProject?.maxOverdueDays]);

  const handleBeforeModalCancel = () => {
    if (editingRecordId) {
      setEditingRecordId(null);
      setEditErrors({});
      return false;
    }
    if (confirmDeleteRecordId) {
      setConfirmDeleteRecordId(null);
      return false;
    }
    return true;
  };

  const handleOverdueDaysSave = () => {
    if (!activeModalProject) return;
    if (activeModalProject.metrics.uncollectedReceivable <= 0) return;
    const n = Number(overdueDraft);
    if (overdueDraft.trim() === '' || !Number.isFinite(n) || n < 0) {
      setOverdueError('逾期天数不可为负数');
      return;
    }
    setOverdueError(null);
    onUpdateOverdueDays(activeModalProject.id, Math.round(n));
  };

  const handleOneClickSettle = () => {
    if (!activeModalProject) return;
    const remaining = activeModalProject.metrics.uncollectedReceivable;
    if (remaining <= 0) return;
    const today = new Date().toISOString().slice(0, 10);
    onAddPaymentRecord(activeModalProject.id, {
      date: today,
      type: '回款',
      amount: remaining,
      voucherNo: `HK-${today.slice(2, 7).replace('-', '')}-${String(
        Math.floor(100 + Math.random() * 899)
      )}`,
      note: `${activeModalProject.milestone}尾款结清到账`,
    });
    setShowAddForm(false);
  };

  const handleAddRecordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalProject) return;
    const validation = validatePaymentRecordForm({
      date: newDate,
      type: newType,
      amount: newAmount,
      voucherNo: newVoucherNo,
      note: newNote,
    });
    if (!validation.valid) {
      setAddErrors(validation.errors);
      const firstInvalid = PAYMENT_FIELD_ORDER.find((k) => validation.errors[k]);
      if (firstInvalid && addFormRef.current) {
        addFormRef.current
          .querySelector<HTMLElement>(`[name="${firstInvalid}"]`)
          ?.focus();
      }
      return;
    }

    onAddPaymentRecord(activeModalProject.id, {
      date: newDate.trim(),
      type: newType,
      amount: Number(newAmount),
      voucherNo: newVoucherNo.trim(),
      note: newNote.trim(),
    });

    setAddErrors({});
    setNewAmount('');
    setNewNote('');
    setNewVoucherNo(
      `${newType === '开票' ? 'FP' : 'HK'}-${new Date()
        .toISOString()
        .slice(2, 7)
        .replace('-', '')}-${String(Math.floor(100 + Math.random() * 899))}`
    );
    setShowAddForm(false);
  };

  const startEditRecord = (r: PaymentRecord) => {
    setConfirmDeleteRecordId(null);
    setEditingRecordId(r.id);
    setEditType(r.type);
    setEditDate(r.date);
    setEditAmount(String(r.amount));
    setEditVoucherNo(r.voucherNo);
    setEditNote(r.note);
    setEditErrors({});
  };

  const handleSaveEditRecord = (e: React.FormEvent, recordId: string) => {
    e.preventDefault();
    if (!activeModalProject) return;
    const validation = validatePaymentRecordForm({
      date: editDate,
      type: editType,
      amount: editAmount,
      voucherNo: editVoucherNo,
      note: editNote,
    });
    if (!validation.valid) {
      setEditErrors(validation.errors);
      const firstInvalid = PAYMENT_FIELD_ORDER.find((k) => validation.errors[k]);
      if (firstInvalid && editFormRef.current) {
        editFormRef.current
          .querySelector<HTMLElement>(`[name="${firstInvalid}"]`)
          ?.focus();
      }
      return;
    }
    onUpdatePaymentRecord(activeModalProject.id, recordId, {
      date: editDate.trim(),
      type: editType,
      amount: Number(editAmount),
      voucherNo: editVoucherNo.trim(),
      note: editNote.trim(),
    });
    setEditingRecordId(null);
    setEditErrors({});
  };

  const toggleBucket = (bucket: string) => {
    setSelectedBucket((prev) => (prev === bucket ? null : bucket));
  };

  const newAmtNum = Number(newAmount);
  const showOverCollectionHint =
    displayModalProject !== null &&
    newType === '回款' &&
    Number.isFinite(newAmtNum) &&
    newAmtNum > displayModalProject.metrics.uncollectedReceivable &&
    displayModalProject.metrics.uncollectedReceivable > 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Row 1: 4 Receivables KPI Cards */}
      <section
        aria-label="回款专项指标"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch"
      >
        <article className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-5 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-medium text-[#475569]">
              累计已开票总额
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center shrink-0">
              <Receipt className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[28px] leading-9 font-bold tracking-tight text-[#0F172A] tabular-nums">
              ¥{summary.totalInvoiced.toFixed(1)}万
            </p>
            <span className="text-xs text-[#64748B] tabular-nums">
              占合同总额 {summary.overallInvoicedRate.toFixed(1)}%
            </span>
          </div>
        </article>

        <article className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-5 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-medium text-[#475569]">
              累计实际回款总额
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#ECFDF5] text-[#10B981] flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[28px] leading-9 font-bold tracking-tight text-[#047857] tabular-nums">
              ¥{summary.totalCollected.toFixed(1)}万
            </p>
            <span className="text-xs text-[#64748B] tabular-nums">
              开票回款转化率 {summary.invoicedCollectionRate.toFixed(1)}%
            </span>
          </div>
        </article>

        <article className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-5 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-medium text-[#475569]">
              开票未回应收总额
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#FFFBEB] text-[#F59E0B] flex items-center justify-center shrink-0">
              <Hourglass className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[28px] leading-9 font-bold tracking-tight text-[#B45309] tabular-nums">
              ¥{summary.totalUncollected.toFixed(1)}万
            </p>
            <span className="text-xs text-[#64748B] tabular-nums">
              涉及 {uncollectedProjectsCount} 个待回款项目
            </span>
          </div>
        </article>

        <article className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-5 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-medium text-[#475569]">
              &gt;60天逾期高危应收
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#FEF2F2] text-[#EF4444] flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[28px] leading-9 font-bold tracking-tight text-[#B91C1C] tabular-nums">
              ¥{summary.overdue60PlusAmount.toFixed(1)}万
            </p>
            <span className="text-xs text-[#64748B] tabular-nums">
              需商务与财务联合专项催收
            </span>
          </div>
        </article>
      </section>

      {/* Row 2: Aging Distribution BarChart + Group Collection Progress */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left: Aging Buckets Chart + Clickable Filter Bars */}
        <article className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-6 flex flex-col justify-between gap-5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold text-[#0F172A]">
                应收账款账龄结构分布
              </h2>
              <p className="text-xs text-[#64748B] tabular-nums">
                开票未回余额 ¥{summary.totalUncollected.toFixed(1)}万 · 点击任意账龄分段筛选下表明细
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {selectedBucket && (
                <button
                  type="button"
                  onClick={() => setSelectedBucket(null)}
                  className="px-2 py-0.5 rounded-md bg-[#EFF6FF] text-[#2563EB] hover:bg-blue-100 text-[11px] font-medium cursor-pointer"
                >
                  全部账龄
                </button>
              )}
              <span className="text-xs text-[#64748B] whitespace-nowrap">
                单位：万元
              </span>
            </div>
          </div>

          <div className="w-full h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={agingBuckets}
                margin={{ top: 6, right: 8, left: -12, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#F1F5F9"
                />
                <XAxis
                  dataKey="bucket"
                  tick={{ fill: '#475569', fontSize: 11 }}
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
                    const b = payload[0].payload;
                    return (
                      <div className="bg-white border border-slate-200 rounded-lg shadow-md px-3 py-2 text-xs tabular-nums">
                        <div className="font-semibold text-[#0F172A]">
                          {b.label}
                        </div>
                        <div className="text-[#475569] mt-0.5">
                          余额 ¥{b.amount.toFixed(1)}万 · 占比 {b.percent}% ({b.count}个项目)
                        </div>
                        <div className="text-[11px] text-[#2563EB] mt-1 font-medium">
                          点击按该账龄筛选明细表
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="amount"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={44}
                  isAnimationActive={false}
                  cursor="pointer"
                  onClick={(data) => {
                    const bucket = (data?.payload as { bucket?: string } | undefined)?.bucket;
                    if (typeof bucket === 'string') toggleBucket(bucket);
                  }}
                >
                  {agingBuckets.map((entry) => (
                    <Cell
                      key={entry.bucket}
                      fill={entry.color}
                      fillOpacity={
                        selectedBucket && selectedBucket !== entry.bucket
                          ? 0.32
                          : 1
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
            {agingBuckets.map((b) => {
              const isSelected = selectedBucket === b.bucket;
              return (
                <button
                  key={b.bucket}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => toggleBucket(b.bucket)}
                  className={`w-full text-left flex flex-col gap-1 rounded-lg px-2 py-1.5 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#EFF6FF]/80 ring-1 ring-[#2563EB]/40'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between text-xs tabular-nums">
                    <span
                      className={
                        b.risk === 'danger' || b.risk === 'critical'
                          ? 'text-[#B91C1C] font-medium'
                          : 'text-[#475569]'
                      }
                    >
                      {b.label} ({b.count}项)
                    </span>
                    <span className="font-medium text-[#0F172A]">
                      ¥{b.amount.toFixed(1)}万 ({b.percent.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${b.percent}%`,
                        backgroundColor: b.color,
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </article>

        {/* Right: Business Group Collection Rate Ranking */}
        <article className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-6 flex flex-col justify-between gap-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-[#0F172A]">
              业务组回款达成率排行
            </h2>
            <p className="text-xs text-[#64748B]">
              按各业务组「累计已回款 / 合同总额」降序衡量现金流回笼效率
            </p>
          </div>

          <div className="flex flex-col gap-5 my-auto">
            {groupRankings.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#64748B]">
                当前筛选条件下暂无业务组回款数据
              </div>
            ) : (
              groupRankings.map((g, idx) => {
                const isHigh = g.collectionRate >= 65;
                const isMid = g.collectionRate >= 45 && g.collectionRate < 65;
                return (
                  <div key={g.group} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-md bg-slate-100 text-[#0F172A] font-semibold flex items-center justify-center tabular-nums">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-[#0F172A]">
                          {g.group}
                        </span>
                        <span className="text-[#64748B] tabular-nums">
                          ({g.projectCount}个项目)
                        </span>
                      </div>
                      <div className="flex items-center gap-3 tabular-nums">
                        <span className="text-[#64748B]">
                          已回 ¥{g.collectedAmount.toFixed(1)}万 / 合同 ¥
                          {g.contractAmount.toFixed(1)}万
                        </span>
                        <span
                          className={`font-bold ${
                            isHigh
                              ? 'text-[#047857]'
                              : isMid
                                ? 'text-[#2563EB]'
                                : 'text-[#B45309]'
                          }`}
                        >
                          {g.collectionRate.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isHigh
                            ? 'bg-[#10B981]'
                            : isMid
                              ? 'bg-[#3B82F6]'
                              : 'bg-[#F59E0B]'
                        }`}
                        style={{
                          width: `${Math.min(100, g.collectionRate)}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="rounded-xl bg-[#F8FAFC] border border-slate-200/80 p-3.5 flex items-center justify-between text-xs text-[#475569] tabular-nums">
            <div className="flex items-center gap-2">
              <CheckCircle2
                className="w-4 h-4 text-[#10B981] shrink-0"
                aria-hidden="true"
              />
              <span>部门整体合同回款率</span>
            </div>
            <span className="font-bold text-[#0F172A]">
              {summary.overallCollectionRate.toFixed(1)}% (¥
              {summary.totalCollected.toFixed(1)}万 / ¥
              {summary.totalContract.toFixed(1)}万)
            </span>
          </div>
        </article>
      </section>

      {/* Row 3: Receivables Tracking Detail Table */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-[#0F172A]">
                项目开票与回款跟踪明细表
              </h2>
              <span className="text-xs text-[#64748B] tabular-nums">
                共 {sortedProjects.length} 个项目
              </span>
              {selectedBucket && (
                <button
                  type="button"
                  onClick={() => setSelectedBucket(null)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#1D4ED8] text-[11px] font-medium cursor-pointer"
                >
                  <span>账龄：{selectedBucket}</span>
                  <X className="w-3 h-3" aria-hidden="true" />
                </button>
              )}
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              按最长逾期账龄降序排列，点击任意行或「收款/开票管理」可增删改单笔明细并实时重算账龄
            </p>
          </div>

          <search
            aria-label="回款明细表筛选"
            className="flex flex-wrap items-center gap-2"
          >
            <button
              type="button"
              aria-pressed={onlyUncollected}
              onClick={() => setOnlyUncollected((prev) => !prev)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                onlyUncollected
                  ? 'bg-[#FFFBEB] border-amber-300 text-[#B45309]'
                  : 'bg-white border-slate-200 text-[#475569] hover:bg-slate-50'
              }`}
            >
              仅看未结清 ({uncollectedProjectsCount})
            </button>

            <div className="relative">
              <Search
                className="w-3.5 h-3.5 text-[#64748B] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                aria-label="搜索回款项目、客户或节点"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索项目、客户或收款节点..."
                className="w-56 pl-8 pr-7 py-1.5 rounded-lg bg-[#F8FAFC] border border-slate-200 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:bg-white transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="清空回款搜索"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#475569] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </search>
        </div>

        <div
          tabIndex={0}
          role="region"
          aria-labelledby={captionId}
          className="w-full overflow-x-auto panel-scroll"
        >
          <table className="w-full min-w-[980px] border-collapse text-left">
            <caption id={captionId} className="visually-hidden">
              项目开票与回款跟踪明细表
            </caption>
            <thead className="bg-[#F8FAFC] border-b border-slate-200/80">
              <tr>
                <th
                  scope="col"
                  className="px-5 py-3 text-xs font-medium text-[#64748B] whitespace-nowrap"
                >
                  项目与客户
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-xs font-medium text-[#64748B] whitespace-nowrap"
                >
                  当前收款节点
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-xs font-medium text-[#64748B] text-right whitespace-nowrap"
                >
                  合同额(万)
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-xs font-medium text-[#64748B] text-right whitespace-nowrap"
                >
                  已开票(万)
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-xs font-medium text-[#64748B] text-right whitespace-nowrap"
                >
                  已回款(万)
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-xs font-medium text-[#64748B] text-right whitespace-nowrap"
                >
                  开票未回(万)
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-xs font-medium text-[#64748B] text-right whitespace-nowrap"
                >
                  回款率
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-xs font-medium text-[#64748B] text-right whitespace-nowrap"
                >
                  账龄
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-xs font-medium text-[#64748B] whitespace-nowrap"
                >
                  账龄状态
                </th>
                <th
                  scope="col"
                  className="px-5 py-3 text-xs font-medium text-[#64748B] text-right whitespace-nowrap"
                >
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedProjects.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-6 py-10 text-center text-xs text-[#64748B]"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <span>当前账龄或搜索条件下暂无匹配项目</span>
                      {(selectedBucket || onlyUncollected || searchQuery) && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBucket(null);
                            setOnlyUncollected(false);
                            setSearchQuery('');
                          }}
                          className="px-3 py-1 rounded-lg bg-[#EFF6FF] hover:bg-blue-100 text-[#2563EB] text-xs font-medium cursor-pointer"
                        >
                          重置回款筛选
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                sortedProjects.map((p) => {
                  const uncollected = p.metrics.uncollectedReceivable;
                  const isOver60 = p.maxOverdueDays > 60 && uncollected > 0;
                  const isMid =
                    p.maxOverdueDays > 30 &&
                    p.maxOverdueDays <= 60 &&
                    uncollected > 0;

                  return (
                    <tr
                      key={p.id}
                      onClick={() => openModal(p)}
                      className="h-14 hover:bg-slate-50/90 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-2.5 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-[13px] font-semibold text-[#0F172A]">
                            {p.name}
                          </span>
                          <span className="text-xs text-[#64748B]">
                            {p.client} · {p.businessGroup}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-[#475569] whitespace-nowrap">
                        {p.milestone}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs text-[#475569] tabular-nums whitespace-nowrap">
                        {p.contractAmount.toFixed(1)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs text-[#0F172A] tabular-nums whitespace-nowrap">
                        {p.invoicedAmount.toFixed(1)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs font-medium text-[#047857] tabular-nums whitespace-nowrap">
                        {p.collectedAmount.toFixed(1)}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right text-[13px] font-semibold tabular-nums whitespace-nowrap ${
                          isOver60
                            ? 'text-[#EF4444]'
                            : uncollected > 0
                              ? 'text-[#B45309]'
                              : 'text-[#64748B]'
                        }`}
                      >
                        {uncollected.toFixed(1)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs font-medium text-[#0F172A] tabular-nums whitespace-nowrap">
                        {p.metrics.collectionRate.toFixed(1)}%
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right text-xs font-medium tabular-nums whitespace-nowrap ${
                          isOver60
                            ? 'text-[#EF4444]'
                            : isMid
                              ? 'text-[#B45309]'
                              : 'text-[#475569]'
                        }`}
                      >
                        {uncollected > 0 ? `${p.maxOverdueDays} 天` : '—'}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {uncollected === 0 ? (
                          <span className="inline-flex px-2.5 py-0.5 rounded-full bg-slate-100 text-[#475569] text-xs font-medium">
                            已结清
                          </span>
                        ) : isOver60 ? (
                          <span className="inline-flex px-2.5 py-0.5 rounded-full bg-[#FEF2F2] text-[#B91C1C] text-xs font-medium">
                            逾期催收
                          </span>
                        ) : isMid ? (
                          <span className="inline-flex px-2.5 py-0.5 rounded-full bg-[#FFFBEB] text-[#B45309] text-xs font-medium">
                            临期跟进
                          </span>
                        ) : (
                          <span className="inline-flex px-2.5 py-0.5 rounded-full bg-[#ECFDF5] text-[#047857] text-xs font-medium">
                            账期内
                          </span>
                        )}
                      </td>
                      <td
                        className="px-5 py-2.5 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => openModal(p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-medium text-[#2563EB] hover:bg-[#EFF6FF] hover:border-[#2563EB]/40 transition-colors cursor-pointer"
                        >
                          <Receipt className="w-3 h-3" aria-hidden="true" />
                          <span>收款/开票管理 ({p.paymentRecords.length})</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Full Billing & Collection Records Management Native Dialog */}
      <ModalDialog
        isOpen={activeModalProject !== null}
        onClose={() => setModalProjectId(null)}
        variant="modal"
        maxWidth="44rem"
        ariaLabelledBy={modalTitleId}
        closedBy="any"
        onBeforeCancel={handleBeforeModalCancel}
      >
        {displayModalProject && (
          <>
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <h1
                  id={modalTitleId}
                  className="text-base font-bold text-[#0F172A]"
                >
                  收款 / 开票明细管理
                </h1>
                <p className="text-xs text-[#64748B] mt-0.5 tabular-nums">
                  {displayModalProject.code} · {displayModalProject.name} ·{' '}
                  {displayModalProject.client}
                </p>
              </div>
              <button
                type="button"
                aria-label="关闭弹窗"
                onClick={() => setModalProjectId(null)}
                className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-[#64748B] hover:bg-slate-100 hover:text-[#0F172A] cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto panel-scroll flex flex-col gap-5">
              {/* Live Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl bg-[#F8FAFC] border border-slate-200/80 p-3.5 text-xs tabular-nums">
                <div>
                  <div className="text-[#64748B]">合同总额</div>
                  <div className="text-sm font-bold text-[#0F172A] mt-0.5">
                    ¥{displayModalProject.contractAmount.toFixed(1)}万
                  </div>
                </div>
                <div>
                  <div className="text-[#64748B]">累计已开票</div>
                  <div className="text-sm font-bold text-[#2563EB] mt-0.5">
                    ¥{displayModalProject.invoicedAmount.toFixed(1)}万
                  </div>
                </div>
                <div>
                  <div className="text-[#64748B]">累计已回款</div>
                  <div className="text-sm font-bold text-[#047857] mt-0.5">
                    ¥{displayModalProject.collectedAmount.toFixed(1)}万
                  </div>
                </div>
                <div>
                  <div className="text-[#64748B]">开票未回余额</div>
                  <div
                    className={`text-sm font-bold mt-0.5 ${
                      displayModalProject.metrics.uncollectedReceivable > 0 &&
                      displayModalProject.maxOverdueDays > 60
                        ? 'text-[#EF4444]'
                        : displayModalProject.metrics.uncollectedReceivable > 0
                          ? 'text-[#B45309]'
                          : 'text-[#047857]'
                    }`}
                  >
                    ¥
                    {displayModalProject.metrics.uncollectedReceivable.toFixed(1)}
                    万
                  </div>
                </div>
              </div>

              {/* Direct Overdue Days Control */}
              <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-[#0F172A]">
                    当前最长逾期天数调节
                  </span>
                  <span className="text-[11px] text-[#64748B]">
                    {displayModalProject.metrics.uncollectedReceivable <= 0
                      ? '该项目应收款已全部结清，逾期账龄自动归零'
                      : '更新后将同步影响「>60天逾期高危应收」与账龄结构柱状图'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    disabled={
                      displayModalProject.metrics.uncollectedReceivable <= 0
                    }
                    aria-label="当前最长逾期天数"
                    value={
                      displayModalProject.metrics.uncollectedReceivable <= 0
                        ? '0'
                        : overdueDraft
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        handleOverdueDaysSave();
                      }
                    }}
                    onChange={(e) => {
                      setOverdueDraft(e.target.value);
                      setOverdueError(null);
                    }}
                    className={`w-20 px-2.5 py-1.5 rounded-lg border text-xs font-semibold text-right tabular-nums ${
                      displayModalProject.metrics.uncollectedReceivable <= 0
                        ? 'border-slate-200 bg-slate-50 text-[#94A3B8] cursor-not-allowed'
                        : overdueError
                          ? 'border-[#EF4444]'
                          : 'border-slate-200'
                    }`}
                  />
                  <span className="text-[#64748B]">天</span>
                  <button
                    type="button"
                    disabled={
                      displayModalProject.metrics.uncollectedReceivable <= 0
                    }
                    onClick={handleOverdueDaysSave}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                      displayModalProject.metrics.uncollectedReceivable <= 0
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-[#0F172A] hover:bg-slate-800 text-white cursor-pointer'
                    }`}
                  >
                    更新账龄
                  </button>
                </div>
                {overdueError && (
                  <p className="w-full text-[11px] text-[#EF4444]">
                    {overdueError}
                  </p>
                )}
              </div>

              {/* Payment Records Stream Header */}
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-xs font-semibold text-[#0F172A]">
                    开票与回款单据流水 (
                    {displayModalProject.paymentRecords.length} 笔)
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                    {displayModalProject.metrics.uncollectedReceivable > 0 && (
                      <button
                        type="button"
                        onClick={handleOneClickSettle}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#ECFDF5] text-[#047857] hover:bg-emerald-100 border border-emerald-200/80 text-xs font-semibold transition-colors cursor-pointer tabular-nums"
                      >
                        <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>
                          一键结清 ¥
                          {displayModalProject.metrics.uncollectedReceivable.toFixed(
                            1
                          )}
                          万
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      aria-expanded={showAddForm}
                      onClick={() => {
                        setShowAddForm((prev) => !prev);
                        setAddErrors({});
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EFF6FF] text-[#2563EB] hover:bg-blue-100 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{showAddForm ? '收起录入表' : '新增开票/回款'}</span>
                    </button>
                  </div>
                </div>

                {/* Add Record Inline Form */}
                {showAddForm && (
                  <form
                    ref={addFormRef}
                    onSubmit={handleAddRecordSubmit}
                    noValidate
                    className="rounded-xl border border-blue-200 bg-[#F8FAFC] p-3.5 flex flex-col gap-3 text-xs"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor={`${baseId}-new-type`}
                          className="text-[#475569] font-medium"
                        >
                          单据类型
                        </label>
                        <select
                          id={`${baseId}-new-type`}
                          name="type"
                          value={newType}
                          onChange={(e) => {
                            const nextT = e.target.value as PaymentRecordType;
                            setNewType(nextT);
                            setNewVoucherNo(
                              `${nextT === '开票' ? 'FP' : 'HK'}-${new Date()
                                .toISOString()
                                .slice(2, 7)
                                .replace('-', '')}-${String(
                                Math.floor(100 + Math.random() * 899)
                              )}`
                            );
                            setNewNote(
                              nextT === '开票'
                                ? `${displayModalProject.milestone}开票登记`
                                : `${displayModalProject.milestone}回款到账`
                            );
                            if (
                              nextT === '回款' &&
                              displayModalProject.metrics.uncollectedReceivable > 0
                            ) {
                              setNewAmount(
                                String(
                                  displayModalProject.metrics
                                    .uncollectedReceivable
                                )
                              );
                            }
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium"
                        >
                          <option value="回款">回款（资金到账）</option>
                          <option value="开票">开票（确认应收）</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor={`${baseId}-new-date`}
                          className="text-[#475569] font-medium"
                        >
                          发生日期 <span aria-hidden="true">*</span>
                        </label>
                        <input
                          id={`${baseId}-new-date`}
                          name="date"
                          type="date"
                          required
                          value={newDate}
                          aria-invalid={addErrors.date ? 'true' : undefined}
                          onChange={(e) => {
                            setNewDate(e.target.value);
                            setAddErrors((prev) => ({ ...prev, date: '' }));
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs tabular-nums"
                        />
                        {addErrors.date && (
                          <span className="text-[11px] text-[#EF4444]">
                            {addErrors.date}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor={`${baseId}-new-amt`}
                          className="text-[#475569] font-medium"
                        >
                          金额 (万元) <span aria-hidden="true">*</span>
                        </label>
                        <input
                          id={`${baseId}-new-amt`}
                          name="amount"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          required
                          placeholder="如 36.0"
                          value={newAmount}
                          aria-invalid={addErrors.amount ? 'true' : undefined}
                          onChange={(e) => {
                            setNewAmount(e.target.value);
                            setAddErrors((prev) => ({ ...prev, amount: '' }));
                          }}
                          className={`px-2.5 py-1.5 rounded-lg border bg-white text-xs font-semibold tabular-nums ${
                            addErrors.amount
                              ? 'border-[#EF4444]'
                              : 'border-slate-200'
                          }`}
                        />
                        {addErrors.amount && (
                          <span className="text-[11px] text-[#EF4444]">
                            {addErrors.amount}
                          </span>
                        )}
                      </div>
                    </div>

                    {showOverCollectionHint && (
                      <div className="rounded-lg bg-[#FFFBEB] border border-amber-200/80 px-3 py-1.5 text-[11px] text-[#B45309] tabular-nums">
                        提示：本次录入回款 ¥{newAmtNum.toFixed(1)}万 高于当前开票未回余额 ¥
                        {displayModalProject.metrics.uncollectedReceivable.toFixed(
                          1
                        )}
                        万（如属预收款项可继续入账）。
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor={`${baseId}-new-vno`}
                          className="text-[#475569] font-medium"
                        >
                          发票/水单号 <span aria-hidden="true">*</span>
                        </label>
                        <input
                          id={`${baseId}-new-vno`}
                          name="voucherNo"
                          type="text"
                          required
                          autoCorrect="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          value={newVoucherNo}
                          aria-invalid={addErrors.voucherNo ? 'true' : undefined}
                          onChange={(e) => {
                            setNewVoucherNo(e.target.value);
                            setAddErrors((prev) => ({
                              ...prev,
                              voucherNo: '',
                            }));
                          }}
                          className={`px-2.5 py-1.5 rounded-lg border bg-white text-xs tabular-nums ${
                            addErrors.voucherNo
                              ? 'border-[#EF4444]'
                              : 'border-slate-200'
                          }`}
                        />
                        {addErrors.voucherNo && (
                          <span className="text-[11px] text-[#EF4444]">
                            {addErrors.voucherNo}
                          </span>
                        )}
                      </div>

                      <div className="sm:col-span-2 flex flex-col gap-1">
                        <label
                          htmlFor={`${baseId}-new-note`}
                          className="text-[#475569] font-medium"
                        >
                          收款节点 / 摘要 <span aria-hidden="true">*</span>
                        </label>
                        <input
                          id={`${baseId}-new-note`}
                          name="note"
                          type="text"
                          required
                          placeholder="如：上线初验款银行回单"
                          value={newNote}
                          aria-invalid={addErrors.note ? 'true' : undefined}
                          onChange={(e) => {
                            setNewNote(e.target.value);
                            setAddErrors((prev) => ({ ...prev, note: '' }));
                          }}
                          className={`px-2.5 py-1.5 rounded-lg border bg-white text-xs ${
                            addErrors.note
                              ? 'border-[#EF4444]'
                              : 'border-slate-200'
                          }`}
                        />
                        {addErrors.note && (
                          <span className="text-[11px] text-[#EF4444]">
                            {addErrors.note}
                          </span>
                        )}
                      </div>
                    </div>

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
                        确认入账并重算全局
                      </button>
                    </div>
                  </form>
                )}

                {/* Records List */}
                <div className="flex flex-col gap-2">
                  {displayModalProject.paymentRecords.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-[#64748B]">
                      暂无开票或回款记录，点击上方「新增开票/回款」录入
                    </div>
                  ) : (
                    displayModalProject.paymentRecords.map((r) => {
                      const isEditing = editingRecordId === r.id;
                      const isConfirming = confirmDeleteRecordId === r.id;

                      if (isEditing) {
                        return (
                          <form
                            key={r.id}
                            ref={editFormRef}
                            onSubmit={(e) => handleSaveEditRecord(e, r.id)}
                            noValidate
                            className="rounded-xl border border-blue-300 bg-[#F8FAFC] p-3 flex flex-col gap-2.5 text-xs"
                          >
                            <div className="grid grid-cols-3 gap-2">
                              <label className="flex flex-col gap-1">
                                <span className="text-[11px] text-[#64748B]">
                                  类型
                                </span>
                                <select
                                  name="type"
                                  value={editType}
                                  onChange={(e) =>
                                    setEditType(
                                      e.target.value as PaymentRecordType
                                    )
                                  }
                                  className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs"
                                >
                                  <option value="开票">开票</option>
                                  <option value="回款">回款</option>
                                </select>
                              </label>

                              <label className="flex flex-col gap-1">
                                <span className="text-[11px] text-[#64748B]">
                                  日期
                                </span>
                                <input
                                  name="date"
                                  type="date"
                                  value={editDate}
                                  onChange={(e) => setEditDate(e.target.value)}
                                  className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs tabular-nums"
                                />
                              </label>

                              <label className="flex flex-col gap-1">
                                <span className="text-[11px] text-[#64748B]">
                                  金额 (万元)
                                </span>
                                <input
                                  name="amount"
                                  type="number"
                                  inputMode="decimal"
                                  step="0.01"
                                  value={editAmount}
                                  aria-invalid={
                                    editErrors.amount ? 'true' : undefined
                                  }
                                  onChange={(e) =>
                                    setEditAmount(e.target.value)
                                  }
                                  className={`px-2 py-1 rounded-lg border bg-white text-xs font-semibold tabular-nums ${
                                    editErrors.amount
                                      ? 'border-[#EF4444]'
                                      : 'border-slate-200'
                                  }`}
                                />
                                {editErrors.amount && (
                                  <span className="text-[11px] text-[#EF4444]">
                                    {editErrors.amount}
                                  </span>
                                )}
                              </label>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              <label className="flex flex-col gap-1">
                                <span className="text-[11px] text-[#64748B]">
                                  单据号
                                </span>
                                <input
                                  name="voucherNo"
                                  type="text"
                                  autoCorrect="off"
                                  autoCapitalize="none"
                                  spellCheck={false}
                                  value={editVoucherNo}
                                  aria-invalid={
                                    editErrors.voucherNo ? 'true' : undefined
                                  }
                                  onChange={(e) =>
                                    setEditVoucherNo(e.target.value)
                                  }
                                  className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs tabular-nums"
                                />
                                {editErrors.voucherNo && (
                                  <span className="text-[11px] text-[#EF4444]">
                                    {editErrors.voucherNo}
                                  </span>
                                )}
                              </label>

                              <label className="col-span-2 flex flex-col gap-1">
                                <span className="text-[11px] text-[#64748B]">
                                  摘要
                                </span>
                                <input
                                  name="note"
                                  type="text"
                                  value={editNote}
                                  aria-invalid={
                                    editErrors.note ? 'true' : undefined
                                  }
                                  onChange={(e) => setEditNote(e.target.value)}
                                  className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs"
                                />
                                {editErrors.note && (
                                  <span className="text-[11px] text-[#EF4444]">
                                    {editErrors.note}
                                  </span>
                                )}
                              </label>
                            </div>

                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingRecordId(null)}
                                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs text-[#475569] cursor-pointer"
                              >
                                取消
                              </button>
                              <button
                                type="submit"
                                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold cursor-pointer"
                              >
                                <Check
                                  className="w-3.5 h-3.5"
                                  aria-hidden="true"
                                />
                                <span>保存</span>
                              </button>
                            </div>
                          </form>
                        );
                      }

                      return (
                        <div
                          key={r.id}
                          className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-3 flex items-center justify-between gap-3 hover:border-slate-300 transition-colors"
                        >
                          <div className="flex flex-col gap-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                                  r.type === '回款'
                                    ? 'bg-[#ECFDF5] text-[#047857]'
                                    : 'bg-[#EFF6FF] text-[#2563EB]'
                                }`}
                              >
                                {r.type}
                              </span>
                              <span className="font-semibold text-[#0F172A] tabular-nums">
                                {r.voucherNo}
                              </span>
                              <span className="text-[#64748B] tabular-nums">
                                {r.date}
                              </span>
                            </div>
                            <p
                              title={r.note}
                              className="text-xs text-[#475569] truncate"
                            >
                              {r.note}
                            </p>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0">
                            <span
                              className={`text-xs font-bold tabular-nums ${
                                r.type === '回款'
                                  ? 'text-[#047857]'
                                  : 'text-[#0F172A]'
                              }`}
                            >
                              {r.type === '回款' ? '+' : ''}¥
                              {r.amount.toFixed(2)}万
                            </span>

                            {isConfirming ? (
                              <div className="inline-flex items-center gap-1 rounded-lg bg-[#FEF2F2] border border-red-200 px-2 py-1">
                                <span className="text-[11px] text-[#B91C1C] font-medium">
                                  确认删？
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeletePaymentRecord(
                                      displayModalProject.id,
                                      r.id
                                    );
                                    setConfirmDeleteRecordId(null);
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-[#EF4444] text-white text-[11px] font-semibold hover:bg-red-600 cursor-pointer"
                                >
                                  删除
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteRecordId(null)}
                                  className="px-1.5 py-0.5 rounded bg-white text-[#475569] text-[11px] hover:bg-slate-100 cursor-pointer"
                                >
                                  取消
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  aria-label={`编辑单据 ${r.voucherNo}`}
                                  title="编辑记录"
                                  onClick={() => startEditRecord(r)}
                                  className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-[#94A3B8] hover:text-[#2563EB] hover:bg-[#EFF6FF] transition-colors cursor-pointer"
                                >
                                  <Pencil
                                    className="w-3.5 h-3.5"
                                    aria-hidden="true"
                                  />
                                </button>
                                <button
                                  type="button"
                                  aria-label={`删除单据 ${r.voucherNo}`}
                                  title="删除记录"
                                  onClick={() => setConfirmDeleteRecordId(r.id)}
                                  className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                                >
                                  <Trash2
                                    className="w-3.5 h-3.5"
                                    aria-hidden="true"
                                  />
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

            {/* Footer */}
            <div className="px-6 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-[11px] text-[#64748B] shrink-0">
              <span>所有开票与回款单据变动将自动汇总并刷新全局回款率与账龄分布</span>
              <button
                type="button"
                onClick={() => setModalProjectId(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-[#334155] hover:bg-slate-50 cursor-pointer"
              >
                完成
              </button>
            </div>
          </>
        )}
      </ModalDialog>
    </div>
  );
};
