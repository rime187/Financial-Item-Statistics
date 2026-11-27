import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  RotateCcw,
  X,
  XCircle,
} from 'lucide-react';
import { ConfirmModal } from './components/ConfirmModal';
import { EacSandbox } from './components/EacSandbox';
import { ExecutiveCockpit } from './components/ExecutiveCockpit';
import { Header } from './components/Header';
import { useTopOpenDialog } from './components/ModalDialog';
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
  exportProjectVouchersCsv,
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
  restorePaymentRecordAtIndex,
  restoreProjectAtIndex,
  restoreVoucherAtIndex,
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
  type: 'success' | 'info' | 'warning' | 'error';
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
  const [receivablesTargetProjectId, setReceivablesTargetProjectId] = useState<
    string | null
  >(null);
  const [eacTargetProjectId, setEacTargetProjectId] = useState<string | null>(
    null
  );
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [pendingDeleteProject, setPendingDeleteProject] =
    useState<EnrichedProject | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isToastPaused, setIsToastPaused] = useState(false);
  const topOpenDialog = useTopOpenDialog();

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch {
      // Ignore storage quota errors
    }
  }, [projects]);

  useEffect(() => {
    if (!toast || isToastPaused) return;
    const timer = window.setTimeout(
      () => setToast(null),
      toast.durationMs ?? 4000
    );
    return () => window.clearTimeout(timer);
  }, [toast, isToastPaused]);

  const showToast = (
    text: string,
    type: ToastMessage['type'] = 'success',
    options?: {
      actionLabel?: string;
      onAction?: () => void;
      durationMs?: number;
    }
  ) => {
    setIsToastPaused(false);
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

  const existingCodes = useMemo(
    () => projects.map((p) => p.code),
    [projects]
  );

  const suggestedProjectCode = useMemo(
    () => generateNextProjectCode(projects),
    [projects]
  );

  const hasActiveFilter =
    filters.businessGroup !== 'all' ||
    filters.stage !== 'all' ||
    filters.healthStatus !== 'all';

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

  const handleSelectBusinessGroup = (group: string) => {
    setFilters((prev) => ({ ...prev, businessGroup: group }));
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
    reader.onerror = () => {
      showToast('读取 CSV 文件失败，请检查文件权限或编码格式', 'error');
    };
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const res = importProjectsFromCsvText(text, projects);
      if (res.addedCount === 0 && res.updatedCount === 0) {
        const hint = res.skippedReasons[0] ? `（${res.skippedReasons[0]}）` : '';
        showToast(
          `未导入有效项目，跳过异常 ${res.skippedCount} 条${hint}`,
          'warning',
          { durationMs: 5500 }
        );
        return;
      }
      setProjects(res.projects.map((item) => normalizeProject(item)));
      const skipNote =
        res.skippedCount > 0 && res.skippedReasons[0]
          ? `（如：${res.skippedReasons[0]}）`
          : '';
      showToast(
        `成功导入 ${res.addedCount} 条，更新 ${res.updatedCount} 条，跳过异常 ${res.skippedCount} 条${skipNote}`,
        res.skippedCount > 0 ? 'warning' : 'success',
        { durationMs: res.skippedCount > 0 ? 5500 : 4000 }
      );
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleExportReport = () => {
    if (filteredProjects.length === 0) {
      showToast('当前筛选条件下暂无可导出的项目，请先放宽筛选条件', 'warning');
      return;
    }
    exportProjectsReportCsv(filteredProjects);
    showToast(
      `已导出当前筛选条件下的 ${filteredProjects.length} 个最新项目财务报表`
    );
  };

  const handleExportVouchers = (project: EnrichedProject) => {
    if (project.vouchers.length === 0) {
      showToast('该项目暂无成本凭证可导出', 'warning');
      return;
    }
    exportProjectVouchersCsv(project);
    showToast(
      `已导出「${project.name}」的 ${project.vouchers.length} 笔成本凭证明细`
    );
  };

  /* ==================== Cross-Tab Operational Jumps ==================== */

  const handleJumpToReceivables = (projectId: string) => {
    setInspectedProjectId(null);
    // Ensure target project isn't hidden by active global filters
    const isVisible = filteredProjects.some((p) => p.id === projectId);
    if (!isVisible) {
      handleResetFilters();
    }
    setReceivablesTargetProjectId(projectId);
    setActiveTab('receivables');
  };

  const handleJumpToEac = (projectId: string) => {
    setInspectedProjectId(null);
    const isVisible = filteredProjects.some((p) => p.id === projectId);
    if (!isVisible) {
      handleResetFilters();
    }
    setEacTargetProjectId(projectId);
    setActiveTab('eac');
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
    showToast(
      `已复制生成「${result.duplicated.name}」(${result.duplicated.code})`
    );
  };

  const handleConfirmDeleteProject = () => {
    if (!pendingDeleteProject) return;
    const deletedIndex = projects.findIndex(
      (p) => p.id === pendingDeleteProject.id
    );
    const deletedRaw = deletedIndex >= 0 ? projects[deletedIndex] : null;
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
      durationMs: 5500,
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

  const handleApplyEacProgress = (projectId: string, progress: number) => {
    const target = projects.find((p) => p.id === projectId);
    if (!target) return;
    setProjects((prev) => updateProjectFields(prev, projectId, { progress }));
    showToast(
      `已将「${target.name}」完工进度更新为 ${progress}%，全局毛利率已同步重算`
    );
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
    const targetProj = projects.find((p) => p.id === projectId);
    const vIdx =
      targetProj?.vouchers.findIndex((v) => v.id === voucherId) ?? -1;
    const deletedVoucher =
      targetProj && vIdx >= 0 ? targetProj.vouchers[vIdx] : null;

    setProjects((prev) => deleteVoucherFromProject(prev, projectId, voucherId));

    if (deletedVoucher) {
      showToast(`已删除成本凭证 ${deletedVoucher.voucherNo}`, 'info', {
        durationMs: 5500,
        actionLabel: '撤销删除',
        onAction: () => {
          setProjects((prev) =>
            restoreVoucherAtIndex(prev, projectId, deletedVoucher, vIdx)
          );
          showToast(`已恢复成本凭证 ${deletedVoucher.voucherNo}`);
        },
      });
    } else {
      showToast('已删除成本凭证，项目成本状态与图表已同步重算', 'info');
    }
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
    const targetProj = projects.find((p) => p.id === projectId);
    const rIdx =
      targetProj?.paymentRecords.findIndex((r) => r.id === recordId) ?? -1;
    const deletedRecord =
      targetProj && rIdx >= 0 ? targetProj.paymentRecords[rIdx] : null;
    const prevOverdue = targetProj?.maxOverdueDays;

    setProjects((prev) =>
      deletePaymentRecordFromProject(prev, projectId, recordId)
    );

    if (deletedRecord) {
      showToast(
        `已删除${deletedRecord.type}单据 ${deletedRecord.voucherNo}`,
        'info',
        {
          durationMs: 5500,
          actionLabel: '撤销删除',
          onAction: () => {
            setProjects((prev) =>
              restorePaymentRecordAtIndex(
                prev,
                projectId,
                deletedRecord,
                rIdx,
                prevOverdue
              )
            );
            showToast(`已恢复单据 ${deletedRecord.voucherNo}`);
          },
        }
      );
    } else {
      showToast('已删除开票/回款单据，全局回款率与应收余额已同步重算', 'info');
    }
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
          totalProjectCount={enrichedProjects.length}
          filteredProjectCount={filteredProjects.length}
          onDownloadTemplate={handleDownloadTemplate}
          onImportCsv={handleImportCsv}
          onExportReport={handleExportReport}
          onOpenNewProject={handleOpenCreateProject}
          onResetDemoData={() => setIsResetConfirmOpen(true)}
        />

        <main
          id={`main-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`main-tab-${activeTab}`}
        >
          {activeTab === 'cockpit' && (
            <ExecutiveCockpit
              projects={filteredProjects}
              activeBusinessGroup={filters.businessGroup}
              onSelectBusinessGroup={handleSelectBusinessGroup}
              onInspectProject={(id) => setInspectedProjectId(id)}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'ledger' && (
            <ProjectLedger
              projects={filteredProjects}
              hasGlobalFilter={hasActiveFilter}
              onResetGlobalFilters={handleResetFilters}
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
              initialModalProjectId={receivablesTargetProjectId}
              onClearInitialModalProject={() =>
                setReceivablesTargetProjectId(null)
              }
              onAddPaymentRecord={handleAddPaymentRecord}
              onUpdatePaymentRecord={handleUpdatePaymentRecord}
              onDeletePaymentRecord={handleDeletePaymentRecord}
              onUpdateOverdueDays={handleUpdateOverdueDays}
            />
          )}

          {activeTab === 'eac' && (
            <EacSandbox
              projects={filteredProjects}
              initialScopeId={eacTargetProjectId}
              onClearInitialScope={() => setEacTargetProjectId(null)}
              onApplyProgressToProject={handleApplyEacProgress}
            />
          )}
        </main>
      </div>

      {/* 600px Native Top-Layer Slide-Over Drawer for Project Inspection & Cost Voucher CRUD */}
      <ProjectDrawer
        project={inspectedProject}
        onClose={() => setInspectedProjectId(null)}
        onEditProject={handleOpenEditProject}
        onRequestDeleteProject={(proj) => setPendingDeleteProject(proj)}
        onJumpToReceivables={handleJumpToReceivables}
        onJumpToEac={handleJumpToEac}
        onExportVouchers={handleExportVouchers}
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
        existingCodes={existingCodes}
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
        description="删除后该项目及其挂载的成本凭证与收款记录将立即从全局 KPI、图表和预警榜中移除（删除后可在右上角快速撤销）。"
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

      {/* Top-Right Soft Toast Notification (portaled into active top-layer dialog when open) */}
      {toast &&
        createPortal(
          <div
            role={toast.type === 'error' ? 'alert' : 'status'}
            aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
            onMouseEnter={() => setIsToastPaused(true)}
            onMouseLeave={() => setIsToastPaused(false)}
            className="fixed top-5 right-5 z-[90] flex items-center gap-2.5 bg-white/95 backdrop-blur-sm border border-slate-200/90 text-[#0F172A] px-4 py-3 rounded-xl shadow-[0_10px_30px_-10px_rgba(15,23,42,0.18)] text-xs font-medium max-w-md"
          >
            {toast.type === 'success' ? (
              <CheckCircle2
                className="w-4 h-4 text-[#10B981] shrink-0"
                aria-hidden="true"
              />
            ) : toast.type === 'warning' ? (
              <AlertTriangle
                className="w-4 h-4 text-[#F59E0B] shrink-0"
                aria-hidden="true"
              />
            ) : toast.type === 'error' ? (
              <XCircle
                className="w-4 h-4 text-[#EF4444] shrink-0"
                aria-hidden="true"
              />
            ) : (
              <Info
                className="w-4 h-4 text-[#2563EB] shrink-0"
                aria-hidden="true"
              />
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
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
                <span>{toast.actionLabel}</span>
              </button>
            )}
            <button
              type="button"
              aria-label="关闭提示"
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-slate-600 ml-0.5 shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>,
          topOpenDialog ?? document.body
        )}
    </div>
  );
}

export default App;
