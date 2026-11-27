import React, { useRef } from 'react';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  Plus,
  RotateCcw,
  Upload,
} from 'lucide-react';
import { FilterState, PROJECT_STAGES, TabId } from '../types';

interface HeaderProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  filters: FilterState;
  onFilterChange: (next: FilterState) => void;
  onResetFilters: () => void;
  businessGroups: string[];
  onDownloadTemplate: () => void;
  onImportCsv: (file: File) => void;
  onExportReport: () => void;
  onOpenNewProject: () => void;
  onResetDemoData: () => void;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'cockpit', label: '驾驶舱总览' },
  { id: 'ledger', label: '项目财务台账' },
  { id: 'receivables', label: '回款与账龄' },
  { id: 'eac', label: 'EAC测算沙盘' },
];

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  filters,
  onFilterChange,
  onResetFilters,
  businessGroups,
  onDownloadTemplate,
  onImportCsv,
  onExportReport,
  onOpenNewProject,
  onResetDemoData,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasActiveFilter =
    filters.businessGroup !== 'all' ||
    filters.stage !== 'all' ||
    filters.healthStatus !== 'all';

  return (
    <header className="flex flex-col gap-4">
      {/* Tier 1: Brand Identity + Global Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#0F172A] flex items-center justify-center shrink-0 shadow-sm">
            <BarChart3 className="w-5 h-5 text-white" strokeWidth={2.2} />
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[20px] leading-7 font-bold tracking-tight text-[#0F172A] whitespace-nowrap">
                部门项目财务统计与管控中台
              </h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#EFF6FF] text-[#1D4ED8] text-xs font-medium whitespace-nowrap">
                2026 财年实时台账
              </span>
            </div>
            <p className="text-xs text-[#64748B]">
              预算执行监控 · 业财毛利核算 · 应收账龄预警 · EAC完工预测
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onDownloadTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white text-[#0F172A] border border-slate-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.03)] text-xs font-medium hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#64748B]" />
            <span>模板下载</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onImportCsv(file);
              }
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white text-[#0F172A] border border-slate-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.03)] text-xs font-medium hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-[#64748B]" />
            <span>导入CSV</span>
          </button>

          <button
            type="button"
            onClick={onExportReport}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white text-[#0F172A] border border-slate-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.03)] text-xs font-medium hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#64748B]" />
            <span>导出报表</span>
          </button>

          <button
            type="button"
            onClick={onOpenNewProject}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-[0_1px_2px_rgba(37,99,235,0.25)] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            <span>新增项目</span>
          </button>
        </div>
      </div>

      {/* Tier 2: View Switcher Tabs + Global Reactive Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav
          aria-label="主视图切换"
          className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200/70 overflow-x-auto max-w-full"
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#0F172A] text-white shadow-xs'
                    : 'text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="按业务组筛选"
            value={filters.businessGroup}
            onChange={(e) =>
              onFilterChange({ ...filters, businessGroup: e.target.value })
            }
            className="px-3 py-1.5 rounded-lg bg-white border border-slate-200/90 text-xs font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] cursor-pointer"
          >
            <option value="all">全部业务组</option>
            {businessGroups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>

          <select
            aria-label="按阶段筛选"
            value={filters.stage}
            onChange={(e) =>
              onFilterChange({ ...filters, stage: e.target.value })
            }
            className="px-3 py-1.5 rounded-lg bg-white border border-slate-200/90 text-xs font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] cursor-pointer"
          >
            <option value="all">全部阶段</option>
            {PROJECT_STAGES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          <select
            aria-label="按健康状态筛选"
            value={filters.healthStatus}
            onChange={(e) =>
              onFilterChange({ ...filters, healthStatus: e.target.value })
            }
            className="px-3 py-1.5 rounded-lg bg-white border border-slate-200/90 text-xs font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] cursor-pointer"
          >
            <option value="all">全部健康状态</option>
            <option value="正常">正常</option>
            <option value="超支">超支</option>
            <option value="回款滞后">回款滞后</option>
          </select>

          <button
            type="button"
            onClick={onResetFilters}
            disabled={!hasActiveFilter}
            className={`px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              hasActiveFilter
                ? 'text-[#2563EB] hover:text-[#1D4ED8] cursor-pointer'
                : 'text-[#94A3B8] cursor-default'
            }`}
          >
            重置筛选
          </button>

          <span
            aria-hidden="true"
            className="hidden sm:inline-block w-px h-3.5 bg-slate-200 mx-0.5"
          />

          <button
            type="button"
            onClick={onResetDemoData}
            title="恢复内置示例数据"
            className="inline-flex items-center gap-1 px-1.5 py-1.5 rounded-md text-xs text-[#94A3B8] hover:text-[#475569] hover:bg-slate-100/80 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>重置示例</span>
          </button>
        </div>
      </div>
    </header>
  );
};
