import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Info, RotateCcw, X } from 'lucide-react';
import { ConfirmModal } from './components/ConfirmModal';
import { EacSandbox } from './components/EacSandbox';
import { ExecutiveCockpit } from './components/ExecutiveCockpit';
import { Header } from './components/Header';
import { NewProjectModal, ProjectEditPatch } from './components/NewProjectModal';
import { ProjectDrawer } from './components/ProjectDrawer';
import { ProjectLedger } from './components/ProjectLedger';
import { ReceivablesAging } from './components/ReceivablesAging';
import { INITIAL_MOCK_PROJECTS } from './data/mockProjects';
import {
  CostVoucher,
  EnrichedProject,
  FilterState,
  PaymentRecord,
  Project,
  ProjectStage,
  TabId,
} from './types';
import {
  downloadCsvTemplate,
  exportProjectsReportCsv,
  importProjectsFromCsvText,
} from './utils/csv';
import { enrichProjects } from './utils/finance';
import {
  addPaymentRecordToProject,
  addVoucherToProject,
  deletePaymentRecordFromProject,
  deleteVoucherFromProject,
  duplicateProjectRecord,
  generateNextProjectCode,
  normalizeProject,
  restoreProjectAtIndex,
  updatePaymentRecordInProject,
  updateProjectFields,
  updateVoucherInProject,
} from './utils/projectOps';

const STORAGE_KEY = 'dept_project_finance_hub_v1';

function loadInitialProjects(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => normalizeProject(item));
      }
    }
  } catch {
    // Fallback to built-in mock projects
  }
  return INITIAL_MOCK_PROJECTS.map((item) => normalizeProject(item));
}

interface ToastMessage {
  id: number;
  type: 'success' | 'info';
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

export function App() {
  const [projects, setProjects] = useState<Project[]>(loadInitialProjects);
  const [activeTab, setActiveTab] = useState<TabId>('cockpit');
  const [filters, setFilters] = useState<FilterState>({
    businessGroup: 'all',
    stage: 'all',
    healthStatus: 'all',
  });
  const [inspectedProjectId, setInspectedProjectId] = useState<string | null>(
    null
  );
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [pendingDeleteProject, setPendingDeleteProject] =
    useState<EnrichedProject | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch {
      // Ignore storage quota errors
    }
  }, [projects]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(
      () => setToast(null),
      toast.durationMs ?? 4000
    );
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (
    text: string,
    type: ToastMessage['type'] = 'success',
    options?: {
      actionLabel?: string;
      onAction?: () => void;
      durationMs?: number;
    }
  ) => {
    setToast({
      id: Date.now(),
      type,
      text,
      actionLabel: options?.actionLabel,
      onAction: options?.onAction,
      durationMs: options?.durationMs,
    });
  };

  // Single-source-of-truth derived state (100% reactive via useMemo)
  const enrichedProjects = useMemo(() => enrichProjects(projects), [projects]);

  const businessGroups = useMemo(() => {
    return Array.from(new Set(projects.map((p) => p.businessGroup)));
  }, [projects]);

  const suggestedProjectCode = useMemo(
    () => generateNextProjectCode(projects),
    [projects]
  );

  const filteredProjects = useMemo(() => {
    return enrichedProjects.filter((p) => {
      if (
        filters.businessGroup !== 'all' &&
        p.businessGroup !== filters.businessGroup
      ) {
        return false;
      }
      if (filters.stage !== 'all' && p.stage !== filters.stage) {
        return false;
      }
      if (
        filters.healthStatus !== 'all' &&
        p.metrics.healthStatus !== filters.healthStatus
      ) {
        return false;
      }
      return true;
    });
  }, [enrichedProjects, filters]);

  const inspectedProject = useMemo(
    () => enrichedProjects.find((p) => p.id === inspectedProjectId) ?? null,
    [enrichedProjects, inspectedProjectId]
  );

  const editingProject = useMemo(
    () => enrichedProjects.find((p) => p.id === editingProjectId) ?? null,
    [enrichedProjects, editingProjectId]
  );

  const handleResetFilters = () => {
    setFilters({
      businessGroup: 'all',
      stage: 'all',
      healthStatus: 'all',
    });
  };

  const handleConfirmResetDemoData = () => {
    setProjects(INITIAL_MOCK_PROJECTS.map((item) => normalizeProject(item)));
    handleResetFilters();
    setInspectedProjectId(null);
    setEditingProjectId(null);
    setIsResetConfirmOpen(false);
    showToast('已恢复 8 个内置企业项目示例数据', 'info');
  };

  const handleDownloadTemplate = () => {
    downloadCsvTemplate();
    showToast('已下载标准中文表头 CSV 导入模板（含 UTF-8 BOM）');
  };

  const handleImportCsv = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const res = importProjectsFromCsvText(text, projects);
      setProjects(res.projects.map((item) => normalizeProject(item)));
      showToast(
        `成功导入 ${res.addedCount} 条，更新 ${res.updatedCount} 条，跳过异常 ${res.skippedCount} 条`
      );
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleExportReport = () => {
    exportProjectsReportCsv(filteredProjects);
    showToast(
      `已导出当前筛选条件下的 ${filteredProjects.length} 个最新项目财务报表`
    );
  };

  /* ==================== Tier 1: Project-Level CRUD ==================== */

  const handleOpenCreateProject = () => {
    setEditingProjectId(null);
    setIsProjectModalOpen(true);
  };

  const handleOpenEditProject = (project: EnrichedProject) => {
    setEditingProjectId(project.id);
    setIsProjectModalOpen(true);
  };

  const handleCreateProject = (newProject: Project) => {
    setProjects((prev) => [normalizeProject(newProject), ...prev]);
    showToast(`已新增项目「${newProject.name}」并同步全局 KPI 与图表`);
  };

  const handleUpdateProject = (projectId: string, patch: ProjectEditPatch) => {
    setProjects((prev) => updateProjectFields(prev, projectId, patch));
    showToast(`已更新项目「${patch.name}」，全局指标与图表已实时重算`);
  };

  const handleDuplicateProject = (projectId: string) => {
    const result = duplicateProjectRecord(projects, projectId);
    if (!result.duplicated) return;
    setProjects(result.projects);
    showToast(`已复制生成「${result.duplicated.name}」(${result.duplicated.code})`);
  };

  const handleConfirmDeleteProject = () => {
    if (!pendingDeleteProject) return;
    const deletedIndex = projects.findIndex(
      (p) => p.id === pendingDeleteProject.id
    );
    const deletedRaw =
      deletedIndex >= 0 ? projects[deletedIndex] : null;
    if (!deletedRaw) {
      setPendingDeleteProject(null);
      return;
    }

    setProjects((prev) => prev.filter((p) => p.id !== deletedRaw.id));
    if (inspectedProjectId === deletedRaw.id) {
      setInspectedProjectId(null);
    }
    if (editingProjectId === deletedRaw.id) {
      setEditingProjectId(null);
      setIsProjectModalOpen(false);
    }
    setPendingDeleteProject(null);

    showToast(`已删除项目「${deletedRaw.name}」`, 'info', {
      durationMs: 5000,
      actionLabel: '撤销删除',
      onAction: () => {
        setProjects((prev) =>
          restoreProjectAtIndex(prev, deletedRaw, deletedIndex)
        );
        showToast(`已撤销删除，恢复项目「${deletedRaw.name}」`);
      },
    });
  };

  const handleUpdateProjectMeta = (
    projectId: string,
    patch: { progress?: number; approvedBudget?: number; stage?: ProjectStage }
  ) => {
    setProjects((prev) => updateProjectFields(prev, projectId, patch));
  };

  /* ==================== Tier 2: Cost Voucher-Level CRUD ==================== */

  const handleAddVoucher = (
    projectId: string,
    voucherData: Omit<CostVoucher, 'id'>
  ) => {
    const { projects: next, created } = addVoucherToProject(
      projects,
      projectId,
      voucherData
    );
    setProjects(next);
    showToast(`已录入凭证 ${created.voucherNo}，成本柱状图与环形图已实时重算`);
  };

  const handleUpdateVoucher = (
    projectId: string,
    voucherId: string,
    voucherData: Omit<CostVoucher, 'id'>
  ) => {
    setProjects((prev) =>
      updateVoucherInProject(prev, projectId, voucherId, voucherData)
    );
    showToast(`已更新凭证 ${voucherData.voucherNo}，成本与毛利率已同步重算`);
  };

  const handleDeleteVoucher = (projectId: string, voucherId: string) => {
    setProjects((prev) => deleteVoucherFromProject(prev, projectId, voucherId));
    showToast('已删除成本凭证，项目成本状态与图表已同步重算', 'info');
  };

  /* ==================== Tier 3: Billing & Collection CRUD ==================== */

  const handleAddPaymentRecord = (
    projectId: string,
    record: Omit<PaymentRecord, 'id'>
  ) => {
    const { projects: next, created } = addPaymentRecordToProject(
      projects,
      projectId,
      record
    );
    setProjects(next);
    showToast(
      `已新增${created.type}记录 ¥${created.amount.toFixed(1)}万，全局回款率与账龄已重算`
    );
  };

  const handleUpdatePaymentRecord = (
    projectId: string,
    recordId: string,
    record: Omit<PaymentRecord, 'id'>
  ) => {
    setProjects((prev) =>
      updatePaymentRecordInProject(prev, projectId, recordId, record)
    );
    showToast(`已修改${record.type}单据 ${record.voucherNo}，账龄与回款率已重算`);
  };

  const handleDeletePaymentRecord = (projectId: string, recordId: string) => {
    setProjects((prev) =>
      deletePaymentRecordFromProject(prev, projectId, recordId)
    );
    showToast('已删除开票/回款单据，全局回款率与应收余额已同步重算', 'info');
  };

  const handleUpdateOverdueDays = (
    projectId: string,
    maxOverdueDays: number
  ) => {
    setProjects((prev) =>
      updateProjectFields(prev, projectId, { maxOverdueDays })
    );
    showToast(`已更新最长逾期账龄为 ${maxOverdueDays} 天，账龄结构已重算`);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      <div className="max-w-[1320px] mx-auto px-6 py-6 flex flex-col gap-5">
        <Header
          activeTab={activeTab}
          onTabChange={setActiveTab}
          filters={filters}
          onFilterChange={setFilters}
          onResetFilters={handleResetFilters}
          businessGroups={businessGroups}
          onDownloadTemplate={handleDownloadTemplate}
          onImportCsv={handleImportCsv}
          onExportReport={handleExportReport}
          onOpenNewProject={handleOpenCreateProject}
          onResetDemoData={() => setIsResetConfirmOpen(true)}
        />

        <main>
          {activeTab === 'cockpit' && (
            <ExecutiveCockpit
              projects={filteredProjects}
              onInspectProject={(id) => setInspectedProjectId(id)}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'ledger' && (
            <ProjectLedger
              projects={filteredProjects}
              selectedProjectId={inspectedProjectId}
              onInspectProject={(id) => setInspectedProjectId(id)}
              onEditProject={handleOpenEditProject}
              onDuplicateProject={handleDuplicateProject}
              onRequestDeleteProject={(proj) => setPendingDeleteProject(proj)}
            />
          )}

          {activeTab === 'receivables' && (
            <ReceivablesAging
              projects={filteredProjects}
              onAddPaymentRecord={handleAddPaymentRecord}
              onUpdatePaymentRecord={handleUpdatePaymentRecord}
              onDeletePaymentRecord={handleDeletePaymentRecord}
              onUpdateOverdueDays={handleUpdateOverdueDays}
            />
          )}

          {activeTab === 'eac' && <EacSandbox projects={filteredProjects} />}
        </main>
      </div>

      {/* 580px Slide-over Drawer for Project Inspection & Cost Voucher CRUD */}
      <ProjectDrawer
        project={inspectedProject}
        onClose={() => setInspectedProjectId(null)}
        onEditProject={handleOpenEditProject}
        onRequestDeleteProject={(proj) => setPendingDeleteProject(proj)}
        onUpdateProjectMeta={handleUpdateProjectMeta}
        onAddVoucher={handleAddVoucher}
        onUpdateVoucher={handleUpdateVoucher}
        onDeleteVoucher={handleDeleteVoucher}
      />

      {/* Shared Create / Edit Project Modal */}
      <NewProjectModal
        isOpen={isProjectModalOpen}
        editingProject={editingProject}
        suggestedCode={suggestedProjectCode}
        onClose={() => {
          setIsProjectModalOpen(false);
          setEditingProjectId(null);
        }}
        onCreateProject={handleCreateProject}
        onUpdateProject={handleUpdateProject}
        existingGroups={businessGroups}
      />

      {/* Delete Project Confirmation Modal */}
      <ConfirmModal
        isOpen={pendingDeleteProject !== null}
        title="确认删除该项目财务台账？"
        description="删除后该项目及其挂载的成本凭证与收款记录将立即从全局 KPI、图表和预警榜中移除（删除后 5 秒内可在右上角撤销）。"
        highlightText={
          pendingDeleteProject
            ? `${pendingDeleteProject.code} · ${pendingDeleteProject.name}`
            : undefined
        }
        confirmLabel="确认删除"
        variant="danger"
        onConfirm={handleConfirmDeleteProject}
        onCancel={() => setPendingDeleteProject(null)}
      />

      {/* Reset Demo Data Confirmation Modal */}
      <ConfirmModal
        isOpen={isResetConfirmOpen}
        title="确认重置为内置示例数据？"
        description="该操作将清空您当前已录入或修改的所有项目、成本凭证与开票回款记录，并恢复为初始 8 个标准企业项目示例。"
        confirmLabel="确认重置示例"
        variant="warning"
        onConfirm={handleConfirmResetDemoData}
        onCancel={() => setIsResetConfirmOpen(false)}
      />

      {/* Top-Right Soft Toast Notification with Optional Undo Action */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-5 right-5 z-[70] flex items-center gap-2.5 bg-white/95 backdrop-blur-sm border border-slate-200/90 text-[#0F172A] px-4 py-3 rounded-xl shadow-[0_10px_30px_-10px_rgba(15,23,42,0.18)] text-xs font-medium max-w-md"
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-[#2563EB] shrink-0" />
          )}
          <span className="leading-snug">{toast.text}</span>
          {toast.actionLabel && toast.onAction && (
            <button
              type="button"
              onClick={() => {
                const fn = toast.onAction;
                setToast(null);
                fn?.();
              }}
              className="ml-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EFF6FF] hover:bg-blue-100 text-[#2563EB] text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{toast.actionLabel}</span>
            </button>
          )}
          <button
            type="button"
            aria-label="关闭提示"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-600 ml-0.5 shrink-0 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
