import React, { useId, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Copy,
  Pencil,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { EnrichedProject } from '../types';
import { calcPortfolioSummary } from '../utils/finance';

interface ProjectLedgerProps {
  projects: EnrichedProject[];
  hasGlobalFilter: boolean;
  onResetGlobalFilters: () => void;
  selectedProjectId: string | null;
  onInspectProject: (projectId: string) => void;
  onEditProject: (project: EnrichedProject) => void;
  onDuplicateProject: (projectId: string) => void;
  onRequestDeleteProject: (project: EnrichedProject) => void;
}

type SortKey =
  | 'none'
  | 'contractAmount'
  | 'actualCost'
  | 'consumptionRate'
  | 'uncollectedReceivable'
  | 'grossMargin';
type SortDir = 'asc' | 'desc';

const SORT_LABELS: Record<Exclude<SortKey, 'none'>, string> = {
  contractAmount: '合同额',
  actualCost: '实际成本',
  consumptionRate: '预算消耗率',
  uncollectedReceivable: '应收未回',
  grossMargin: '毛利率',
};

export const ProjectLedger: React.FC<ProjectLedgerProps> = ({
  projects,
  hasGlobalFilter,
  onResetGlobalFilters,
  selectedProjectId,
  onInspectProject,
  onEditProject,
  onDuplicateProject,
  onRequestDeleteProject,
}) => {
  const captionId = useId();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('none');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [sortAnnouncement, setSortAnnouncement] = useState('');

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = q
      ? projects.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.code.toLowerCase().includes(q) ||
            p.manager.toLowerCase().includes(q) ||
            p.businessGroup.toLowerCase().includes(q) ||
            p.client.toLowerCase().includes(q) ||
            p.milestone.toLowerCase().includes(q)
        )
      : [...projects];

    if (sortKey === 'none') return list;

    return list.sort((a, b) => {
      let va = 0;
      let vb = 0;
      if (sortKey === 'contractAmount') {
        va = a.contractAmount;
        vb = b.contractAmount;
      } else if (sortKey === 'actualCost') {
        va = a.metrics.actualCost;
        vb = b.metrics.actualCost;
      } else if (sortKey === 'consumptionRate') {
        va = a.metrics.budgetConsumptionRate;
        vb = b.metrics.budgetConsumptionRate;
      } else if (sortKey === 'uncollectedReceivable') {
        va = a.metrics.uncollectedReceivable;
        vb = b.metrics.uncollectedReceivable;
      } else if (sortKey === 'grossMargin') {
        va = a.metrics.grossMargin;
        vb = b.metrics.grossMargin;
      }
      return sortDir === 'asc' ? va - vb : vb - va;
    });
  }, [projects, searchQuery, sortKey, sortDir]);

  const toggleSort = (key: Exclude<SortKey, 'none'>) => {
    let nextKey: SortKey = key;
    let nextDir: SortDir = 'desc';
    if (sortKey !== key) {
      nextKey = key;
      nextDir = 'desc';
    } else if (sortDir === 'desc') {
      nextKey = key;
      nextDir = 'asc';
    } else {
      nextKey = 'none';
    }

    setSortKey(nextKey);
    setSortDir(nextDir);

    if (nextKey === 'none') {
      setSortAnnouncement(`已恢复默认排序，共 ${filteredAndSorted.length} 个项目`);
    } else {
      setSortAnnouncement(
        `已按${SORT_LABELS[nextKey]}${nextDir === 'asc' ? '升序' : '降序'}排列，共 ${filteredAndSorted.length} 个项目`
      );
    }
  };

  const summary = useMemo(
    () => calcPortfolioSummary(filteredAndSorted),
    [filteredAndSorted]
  );

  const ariaSortFor = (
    key: Exclude<SortKey, 'none'>
  ): 'ascending' | 'descending' | undefined => {
    if (sortKey !== key) return undefined;
    return sortDir === 'asc' ? 'ascending' : 'descending';
  };

  const renderSortIcon = (key: Exclude<SortKey, 'none'>) => {
    if (sortKey !== key) {
      return (
        <ArrowUpDown
          className="w-3.5 h-3.5 text-[#94A3B8]"
          aria-hidden="true"
        />
      );
    }
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-[#2563EB]" aria-hidden="true" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-[#2563EB]" aria-hidden="true" />
    );
  };

  return (
    <section
      aria-label="项目财务台账明细表"
      className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden"
    >
      {/* Screen-reader sort status announcement (never put aria-live on the table itself) */}
      <div role="status" className="visually-hidden">
        {sortAnnouncement}
      </div>

      {/* Table Card Header */}
      <div className="px-6 py-4 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-base font-semibold text-[#0F172A]">
            全量项目财务台账
          </h2>
          <span className="text-xs text-[#64748B] tabular-nums">
            共 {filteredAndSorted.length} 个项目 · 点击任意行快速穿透核查
          </span>
        </div>

        <search aria-label="台账表格搜索" className="relative">
          <Search
            className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            name="ledgerSearch"
            aria-label="搜索项目名称、编号、客户或负责人"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索项目、编号、客户或负责人..."
            className="w-72 pl-9 pr-8 py-1.5 rounded-lg bg-[#F8FAFC] border border-slate-200 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:bg-white transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="清空搜索关键字"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md inline-flex items-center justify-center text-[#94A3B8] hover:text-[#475569] hover:bg-slate-200/60 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </search>
      </div>

      {/* Keyboard-Scrollable Accessible Table Region */}
      <div
        tabIndex={0}
        role="region"
        aria-labelledby={captionId}
        className="w-full overflow-x-auto panel-scroll"
      >
        <table className="w-full min-w-[1040px] border-collapse text-left">
          <caption id={captionId} className="visually-hidden">
            部门全量项目财务台账明细表，支持按合同额、实际成本、预算消耗率、应收未回与毛利率排序
          </caption>
          <thead className="bg-[#F8FAFC] border-b border-slate-200/80">
            <tr>
              <th
                scope="col"
                className="pl-5 pr-2.5 py-3 text-xs font-medium text-[#64748B] whitespace-nowrap"
              >
                项目编号与名称
              </th>
              <th
                scope="col"
                className="px-2 py-3 text-xs font-medium text-[#64748B] whitespace-nowrap"
              >
                业务组 / 负责人
              </th>
              <th
                scope="col"
                className="px-2 py-3 text-xs font-medium text-[#64748B] whitespace-nowrap"
              >
                阶段
              </th>
              <th
                scope="col"
                aria-sort={ariaSortFor('contractAmount')}
                className="px-2 py-3 text-xs font-medium text-[#64748B] text-right whitespace-nowrap"
              >
                <button
                  type="button"
                  onClick={() => toggleSort('contractAmount')}
                  className="inline-flex items-center gap-1 min-h-[24px] hover:text-[#0F172A] cursor-pointer"
                >
                  <span>合同额(万)</span>
                  {renderSortIcon('contractAmount')}
                </button>
              </th>
              <th
                scope="col"
                className="px-2 py-3 text-xs font-medium text-[#64748B] text-right whitespace-nowrap"
              >
                预算(万)
              </th>
              <th
                scope="col"
                aria-sort={ariaSortFor('actualCost')}
                className="px-2 py-3 text-xs font-medium text-[#64748B] text-right whitespace-nowrap"
              >
                <button
                  type="button"
                  onClick={() => toggleSort('actualCost')}
                  className="inline-flex items-center gap-1 min-h-[24px] hover:text-[#0F172A] cursor-pointer"
                >
                  <span>成本(万)</span>
                  {renderSortIcon('actualCost')}
                </button>
              </th>
              <th
                scope="col"
                aria-sort={ariaSortFor('consumptionRate')}
                className="px-2 py-3 text-xs font-medium text-[#64748B] whitespace-nowrap"
              >
                <button
                  type="button"
                  onClick={() => toggleSort('consumptionRate')}
                  className="inline-flex items-center gap-1 min-h-[24px] hover:text-[#0F172A] cursor-pointer"
                >
                  <span>预算消耗率</span>
                  {renderSortIcon('consumptionRate')}
                </button>
              </th>
              <th
                scope="col"
                aria-sort={ariaSortFor('uncollectedReceivable')}
                className="px-2 py-3 text-xs font-medium text-[#64748B] text-right whitespace-nowrap"
              >
                <button
                  type="button"
                  onClick={() => toggleSort('uncollectedReceivable')}
                  className="inline-flex items-center gap-1 min-h-[24px] hover:text-[#0F172A] cursor-pointer"
                >
                  <span>开票 / 回款 / 未回</span>
                  {renderSortIcon('uncollectedReceivable')}
                </button>
              </th>
              <th
                scope="col"
                aria-sort={ariaSortFor('grossMargin')}
                className="px-2 py-3 text-xs font-medium text-[#64748B] text-right whitespace-nowrap"
              >
                <button
                  type="button"
                  onClick={() => toggleSort('grossMargin')}
                  className="inline-flex items-center gap-1 min-h-[24px] hover:text-[#0F172A] cursor-pointer"
                >
                  <span>毛利率</span>
                  {renderSortIcon('grossMargin')}
                </button>
              </th>
              <th
                scope="col"
                className="px-2 py-3 text-xs font-medium text-[#64748B] whitespace-nowrap"
              >
                健康状态
              </th>
              <th
                scope="col"
                className="pl-2 pr-5 py-3 text-xs font-medium text-[#64748B] text-right whitespace-nowrap"
              >
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td
                  colSpan={11}
                  className="px-6 py-12 text-center text-sm text-[#64748B]"
                >
                  <div className="flex flex-col items-center gap-2.5">
                    <span>未找到匹配的项目记录，请调整搜索关键字或筛选条件</span>
                    {(searchQuery || hasGlobalFilter) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          onResetGlobalFilters();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#EFF6FF] hover:bg-blue-100 text-[#2563EB] text-xs font-medium transition-colors cursor-pointer"
                      >
                        清空搜索与全局筛选
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredAndSorted.map((p) => {
                const isSelected = selectedProjectId === p.id;
                const { metrics } = p;
                const rate = metrics.budgetConsumptionRate;
                const isOver = metrics.isOverrunWarning;
                const isLag = metrics.isCollectionLag;
                const budgetDelta = p.approvedBudget - metrics.actualCost;

                return (
                  <tr
                    key={p.id}
                    onClick={() => onInspectProject(p.id)}
                    className={`h-14 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#EFF6FF]/60'
                        : 'hover:bg-slate-50/90'
                    }`}
                  >
                    <td className="pl-5 pr-2.5 py-2.5 whitespace-nowrap">
                      <div className="flex flex-col max-w-[195px] xl:max-w-[230px]">
                        <span
                          title={`${p.name} (${p.client})`}
                          className="text-[13px] font-semibold text-[#0F172A] truncate"
                        >
                          {p.name}
                        </span>
                        <span className="text-[11px] text-[#64748B] tabular-nums truncate">
                          {p.code} · 进度 {p.progress}%
                        </span>
                      </div>
                    </td>

                    <td className="px-2 py-2.5 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-[#0F172A]">
                          {p.businessGroup}
                        </span>
                        <span className="text-[11px] text-[#64748B]">
                          {p.manager}
                        </span>
                      </div>
                    </td>

                    <td className="px-2 py-2.5 whitespace-nowrap text-xs text-[#475569]">
                      {p.stage}
                    </td>

                    <td className="px-2 py-2.5 text-right text-xs font-medium text-[#0F172A] tabular-nums whitespace-nowrap">
                      {p.contractAmount.toFixed(1)}
                    </td>

                    <td className="px-2 py-2.5 text-right text-xs text-[#64748B] tabular-nums whitespace-nowrap">
                      {p.approvedBudget.toFixed(1)}
                    </td>

                    <td
                      className={`px-2 py-2.5 text-right text-[13px] font-semibold tabular-nums whitespace-nowrap ${
                        metrics.isOverBudget
                          ? 'text-[#EF4444]'
                          : 'text-[#0F172A]'
                      }`}
                    >
                      {metrics.actualCost.toFixed(1)}
                    </td>

                    <td
                      className="px-2 py-2.5 whitespace-nowrap"
                      title={
                        budgetDelta < 0
                          ? `超出预算 ¥${Math.abs(budgetDelta).toFixed(1)}万`
                          : `预算余量 ¥${budgetDelta.toFixed(1)}万`
                      }
                    >
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1.5 rounded-full bg-slate-100 overflow-hidden shrink-0">
                          <div
                            className={`h-full rounded-full ${
                              isOver ? 'bg-[#EF4444]' : 'bg-[#3B82F6]'
                            }`}
                            style={{ width: `${Math.min(100, rate)}%` }}
                          />
                        </div>
                        <span
                          className={`text-xs font-medium tabular-nums ${
                            isOver ? 'text-[#B91C1C]' : 'text-[#475569]'
                          }`}
                        >
                          {rate.toFixed(1)}%
                        </span>
                      </div>
                    </td>

                    <td className="px-2 py-2.5 text-right text-xs tabular-nums whitespace-nowrap">
                      <span className="text-[#475569]">
                        {p.invoicedAmount.toFixed(0)}
                      </span>
                      <span className="text-[#94A3B8]"> / </span>
                      <span className="text-[#0F172A] font-medium">
                        {p.collectedAmount.toFixed(0)}
                      </span>
                      <span className="text-[#94A3B8]"> / </span>
                      <span
                        className={
                          metrics.uncollectedReceivable > 0 &&
                          p.maxOverdueDays > 60
                            ? 'text-[#EF4444] font-semibold'
                            : 'text-[#64748B]'
                        }
                      >
                        {metrics.uncollectedReceivable.toFixed(0)}
                      </span>
                    </td>

                    <td
                      className={`px-2 py-2.5 text-right text-[13px] font-semibold tabular-nums whitespace-nowrap ${
                        metrics.grossMargin < 0
                          ? 'text-[#EF4444]'
                          : metrics.grossMargin < 32
                            ? 'text-[#F59E0B]'
                            : 'text-[#10B981]'
                      }`}
                    >
                      {metrics.grossMargin.toFixed(1)}%
                    </td>

                    <td className="px-2 py-2.5 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          isOver
                            ? 'bg-[#FEF2F2] text-[#B91C1C]'
                            : isLag
                              ? 'bg-[#FFFBEB] text-[#B45309]'
                              : 'bg-[#ECFDF5] text-[#047857]'
                        }`}
                      >
                        {metrics.healthStatus}
                      </span>
                    </td>

                    <td
                      className="pl-2 pr-5 py-2.5 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onInspectProject(p.id)}
                          className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-xs font-medium text-[#2563EB] hover:bg-[#EFF6FF] transition-colors cursor-pointer"
                        >
                          <span>穿透核查</span>
                          <ArrowRight className="w-3 h-3" aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          aria-label={`编辑项目 ${p.name}`}
                          title="编辑项目"
                          onClick={() => onEditProject(p)}
                          className="w-6 h-6 rounded-md inline-flex items-center justify-center text-[#64748B] hover:text-[#2563EB] hover:bg-[#EFF6FF] transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          aria-label={`复制项目 ${p.name}`}
                          title="复制项目"
                          onClick={() => onDuplicateProject(p.id)}
                          className="w-6 h-6 rounded-md inline-flex items-center justify-center text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          aria-label={`删除项目 ${p.name}`}
                          title="删除项目"
                          onClick={() => onRequestDeleteProject(p)}
                          className="w-6 h-6 rounded-md inline-flex items-center justify-center text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          {/* Automatic Summary Footer Row */}
          {filteredAndSorted.length > 0 && (
            <tfoot className="bg-[#F8FAFC] border-t border-slate-200">
              <tr className="h-12 font-semibold text-xs text-[#0F172A]">
                <td className="pl-5 pr-2.5 py-2.5 whitespace-nowrap" colSpan={3}>
                  合计 / 综合加权 ({summary.projectCount} 个项目)
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums whitespace-nowrap">
                  ¥{summary.totalContract.toFixed(1)}万
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums whitespace-nowrap text-[#475569]">
                  ¥{summary.totalBudget.toFixed(1)}万
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums whitespace-nowrap">
                  ¥{summary.totalActualCost.toFixed(1)}万
                </td>
                <td
                  className={`px-2 py-2.5 tabular-nums whitespace-nowrap ${
                    summary.overallBudgetConsumptionRate > 100
                      ? 'text-[#EF4444]'
                      : 'text-[#2563EB]'
                  }`}
                >
                  {summary.overallBudgetConsumptionRate.toFixed(1)}%
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums whitespace-nowrap">
                  {summary.totalInvoiced.toFixed(0)} /{' '}
                  {summary.totalCollected.toFixed(0)} /{' '}
                  <span className="text-[#F59E0B]">
                    {summary.totalUncollected.toFixed(0)}
                  </span>
                </td>
                <td
                  className={`px-2 py-2.5 text-right tabular-nums whitespace-nowrap ${
                    summary.overallGrossMargin < 32
                      ? 'text-[#F59E0B]'
                      : 'text-[#10B981]'
                  }`}
                >
                  {summary.overallGrossMargin.toFixed(1)}%
                </td>
                <td
                  colSpan={2}
                  className="pl-2 pr-5 py-2.5 text-right text-[#64748B] font-normal whitespace-nowrap"
                >
                  异常 {summary.alertCount} 项
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
};
