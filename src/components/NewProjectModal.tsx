import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  CostVoucher,
  EnrichedProject,
  PROJECT_STAGES,
  Project,
  ProjectStage,
} from '../types';
import { round1 } from '../utils/finance';
import {
  buildInitialPaymentRecords,
  validateProjectForm,
} from '../utils/projectOps';

export interface ProjectEditPatch {
  code: string;
  name: string;
  client: string;
  milestone: string;
  businessGroup: string;
  manager: string;
  stage: ProjectStage;
  contractAmount: number;
  approvedBudget: number;
  progress: number;
  maxOverdueDays: number;
}

interface NewProjectModalProps {
  isOpen: boolean;
  editingProject: EnrichedProject | null;
  suggestedCode: string;
  onClose: () => void;
  onCreateProject: (project: Project) => void;
  onUpdateProject: (projectId: string, patch: ProjectEditPatch) => void;
  existingGroups: string[];
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  editingProject,
  suggestedCode,
  onClose,
  onCreateProject,
  onUpdateProject,
  existingGroups,
}) => {
  const isEditMode = editingProject !== null;

  const [code, setCode] = useState(suggestedCode);
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [milestone, setMilestone] = useState('上线初验款 (30%)');
  const [businessGroup, setBusinessGroup] = useState(
    existingGroups[0] || '智慧能源组'
  );
  const [manager, setManager] = useState('');
  const [stage, setStage] = useState<ProjectStage>('实施中');
  const [contractAmount, setContractAmount] = useState('240');
  const [approvedBudget, setApprovedBudget] = useState('160');
  const [progress, setProgress] = useState('50');
  const [invoicedAmount, setInvoicedAmount] = useState('120');
  const [collectedAmount, setCollectedAmount] = useState('96');
  const [maxOverdueDays, setMaxOverdueDays] = useState('15');
  const [laborCost, setLaborCost] = useState('45');
  const [procurementCost, setProcurementCost] = useState('22');
  const [outsourcingCost, setOutsourcingCost] = useState('10');
  const [travelCost, setTravelCost] = useState('4');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    setErrors({});
    if (editingProject) {
      setCode(editingProject.code);
      setName(editingProject.name);
      setClient(editingProject.client);
      setMilestone(editingProject.milestone);
      setBusinessGroup(editingProject.businessGroup);
      setManager(editingProject.manager);
      setStage(editingProject.stage);
      setContractAmount(String(editingProject.contractAmount));
      setApprovedBudget(String(editingProject.approvedBudget));
      setProgress(String(editingProject.progress));
      setInvoicedAmount(String(editingProject.invoicedAmount));
      setCollectedAmount(String(editingProject.collectedAmount));
      setMaxOverdueDays(String(editingProject.maxOverdueDays));
    } else {
      setCode(suggestedCode);
      setName('');
      setClient('');
      setMilestone('上线初验款 (30%)');
      setBusinessGroup(existingGroups[0] || '智慧能源组');
      setManager('');
      setStage('实施中');
      setContractAmount('240');
      setApprovedBudget('160');
      setProgress('50');
      setInvoicedAmount('120');
      setCollectedAmount('96');
      setMaxOverdueDays('15');
      setLaborCost('45');
      setProcurementCost('22');
      setOutsourcingCost('10');
      setTravelCost('4');
    }
  }, [isOpen, editingProject, suggestedCode, existingGroups]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const clearError = (field: string) => {
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateProjectForm(
      {
        code,
        name,
        client,
        milestone,
        businessGroup,
        manager,
        stage,
        contractAmount,
        approvedBudget,
        progress,
        invoicedAmount,
        collectedAmount,
        maxOverdueDays,
        laborCost,
        procurementCost,
        outsourcingCost,
        travelCost,
      },
      isEditMode ? 'edit' : 'create'
    );

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    if (isEditMode && editingProject) {
      onUpdateProject(editingProject.id, {
        code: code.trim(),
        name: name.trim(),
        client: client.trim() || '重点企业客户',
        milestone: milestone.trim() || '阶段进度款',
        businessGroup: businessGroup.trim() || '数智底座组',
        manager: manager.trim(),
        stage,
        contractAmount: round1(Number(contractAmount)),
        approvedBudget: Math.max(1, round1(Number(approvedBudget))),
        progress: Math.min(100, Math.max(0, Math.round(Number(progress)))),
        maxOverdueDays: Math.max(0, Math.round(Number(maxOverdueDays))),
      });
      onClose();
      return;
    }

    const id = `prj-${Date.now()}`;
    const today = new Date().toISOString().slice(0, 10);
    const vouchers: CostVoucher[] = [];

    const addInit = (
      category: CostVoucher['category'],
      source: CostVoucher['source'],
      taxRate: number,
      amount: number,
      idx: number
    ) => {
      if (amount > 0) {
        vouchers.push({
          id: `${id}-v${idx}`,
          date: today,
          voucherNo: `INIT-${Date.now().toString().slice(-4)}-0${idx}`,
          category,
          source,
          amountExclTax: round1(amount),
          taxRate,
          summary: `立项初始化${category}成本归集`,
        });
      }
    };

    addInit('人工工时', 'HR', 0, Number(laborCost) || 0, 1);
    addInit('软硬件采购', 'ERP', 13, Number(procurementCost) || 0, 2);
    addInit('外包技术', 'OA', 6, Number(outsourcingCost) || 0, 3);
    addInit('差旅实施', 'OA', 6, Number(travelCost) || 0, 4);

    const inv = round1(Number(invoicedAmount) || 0);
    const col = round1(Number(collectedAmount) || 0);
    const ms = milestone.trim() || '阶段进度款';

    onCreateProject({
      id,
      code: code.trim(),
      name: name.trim(),
      client: client.trim() || '重点企业客户',
      milestone: ms,
      businessGroup: businessGroup.trim() || '数智底座组',
      manager: manager.trim(),
      stage,
      contractAmount: round1(Number(contractAmount)),
      approvedBudget: Math.max(1, round1(Number(approvedBudget))),
      progress: Math.min(100, Math.max(0, Math.round(Number(progress)))),
      invoicedAmount: inv,
      collectedAmount: col,
      maxOverdueDays:
        Math.max(0, inv - col) === 0
          ? 0
          : Math.max(0, Math.round(Number(maxOverdueDays) || 0)),
      vouchers,
      paymentRecords: buildInitialPaymentRecords(id, inv, col, ms, today),
    });

    onClose();
  };

  const inputClass = (field: string) =>
    `px-3 py-2 rounded-lg border text-xs transition-colors focus:outline-none focus:ring-2 ${
      errors[field]
        ? 'border-[#EF4444] bg-[#FEF2F2]/40 focus:ring-[#EF4444]/25 focus:border-[#EF4444]'
        : 'border-slate-200 bg-white focus:ring-[#2563EB]/30 focus:border-[#2563EB]'
    }`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 backdrop-blur-[1px] p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEditMode ? '编辑项目信息' : '新增项目'}
        className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-[#0F172A]">
              {isEditMode ? '编辑项目财务档案' : '新增项目财务台账'}
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              {isEditMode
                ? '修改基础档案、合同预算与进度，保存后全局 KPI 与图表实时重算'
                : '录入立项合同、回款账龄及四大成本科目初始发生额（自动生成凭证）'}
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭弹窗"
            onClick={onClose}
            className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-[#64748B] hover:bg-slate-100 hover:text-[#0F172A] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="p-6 overflow-y-auto flex flex-col gap-5 text-xs"
        >
          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-medium text-[#475569]">项目编号 *</span>
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  clearError('code');
                }}
                className={`${inputClass('code')} tabular-nums`}
              />
              {errors.code && (
                <span className="text-[11px] text-[#EF4444]">{errors.code}</span>
              )}
            </label>
            <label className="sm:col-span-2 flex flex-col gap-1">
              <span className="font-medium text-[#475569]">项目名称 *</span>
              <input
                type="text"
                placeholder="例如：华南智能微电网调度系统"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearError('name');
                }}
                className={inputClass('name')}
              />
              {errors.name && (
                <span className="text-[11px] text-[#EF4444]">{errors.name}</span>
              )}
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-medium text-[#475569]">所属业务组</span>
              <select
                value={businessGroup}
                onChange={(e) => setBusinessGroup(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
              >
                {Array.from(
                  new Set([
                    ...existingGroups,
                    '智慧能源组',
                    '工业装备组',
                    '自动化集成组',
                    '数智底座组',
                  ])
                ).map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-medium text-[#475569]">负责人 *</span>
              <input
                type="text"
                placeholder="姓名"
                value={manager}
                onChange={(e) => {
                  setManager(e.target.value);
                  clearError('manager');
                }}
                className={inputClass('manager')}
              />
              {errors.manager && (
                <span className="text-[11px] text-[#EF4444]">
                  {errors.manager}
                </span>
              )}
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-medium text-[#475569]">当前阶段</span>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as ProjectStage)}
                className="px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
              >
                {PROJECT_STAGES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-medium text-[#475569]">客户名称</span>
              <input
                type="text"
                placeholder="企业/园区名称"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium text-[#475569]">当前收款节点</span>
              <input
                type="text"
                value={milestone}
                onChange={(e) => setMilestone(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
              />
            </label>
          </div>

          {/* Financials */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            <label className="flex flex-col gap-1">
              <span className="font-medium text-[#475569]">合同额 (万元) *</span>
              <input
                type="number"
                step="0.1"
                value={contractAmount}
                onChange={(e) => {
                  setContractAmount(e.target.value);
                  clearError('contractAmount');
                }}
                className={`${inputClass('contractAmount')} tabular-nums`}
              />
              {errors.contractAmount && (
                <span className="text-[11px] text-[#EF4444]">
                  {errors.contractAmount}
                </span>
              )}
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-medium text-[#475569]">核定预算 (万元) *</span>
              <input
                type="number"
                step="0.1"
                value={approvedBudget}
                onChange={(e) => {
                  setApprovedBudget(e.target.value);
                  clearError('approvedBudget');
                }}
                className={`${inputClass('approvedBudget')} tabular-nums`}
              />
              {errors.approvedBudget && (
                <span className="text-[11px] text-[#EF4444]">
                  {errors.approvedBudget}
                </span>
              )}
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-medium text-[#475569]">完工进度 (0~100%) *</span>
              <input
                type="number"
                step="1"
                value={progress}
                onChange={(e) => {
                  setProgress(e.target.value);
                  clearError('progress');
                }}
                className={`${inputClass('progress')} tabular-nums`}
              />
              {errors.progress && (
                <span className="text-[11px] text-[#EF4444]">
                  {errors.progress}
                </span>
              )}
            </label>

            {!isEditMode && (
              <>
                <label className="flex flex-col gap-1">
                  <span className="font-medium text-[#475569]">已开票 (万元)</span>
                  <input
                    type="number"
                    step="0.1"
                    value={invoicedAmount}
                    onChange={(e) => {
                      setInvoicedAmount(e.target.value);
                      clearError('invoicedAmount');
                    }}
                    className={`${inputClass('invoicedAmount')} tabular-nums`}
                  />
                  {errors.invoicedAmount && (
                    <span className="text-[11px] text-[#EF4444]">
                      {errors.invoicedAmount}
                    </span>
                  )}
                </label>

                <label className="flex flex-col gap-1">
                  <span className="font-medium text-[#475569]">已回款 (万元)</span>
                  <input
                    type="number"
                    step="0.1"
                    value={collectedAmount}
                    onChange={(e) => {
                      setCollectedAmount(e.target.value);
                      clearError('collectedAmount');
                    }}
                    className={`${inputClass('collectedAmount')} tabular-nums`}
                  />
                  {errors.collectedAmount && (
                    <span className="text-[11px] text-[#EF4444]">
                      {errors.collectedAmount}
                    </span>
                  )}
                </label>
              </>
            )}

            <label className="flex flex-col gap-1">
              <span className="font-medium text-[#475569]">最长逾期 (天)</span>
              <input
                type="number"
                step="1"
                value={maxOverdueDays}
                onChange={(e) => {
                  setMaxOverdueDays(e.target.value);
                  clearError('maxOverdueDays');
                }}
                className={`${inputClass('maxOverdueDays')} tabular-nums`}
              />
              {errors.maxOverdueDays && (
                <span className="text-[11px] text-[#EF4444]">
                  {errors.maxOverdueDays}
                </span>
              )}
            </label>
          </div>

          {/* Create Mode: Initial Cost Categories | Edit Mode: Read-Only Sub-ledger Summary */}
          {isEditMode && editingProject ? (
            <div className="rounded-xl bg-[#F8FAFC] border border-slate-200/80 p-3.5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#0F172A]">
                  凭证与收款明细实时汇总（单一数据源自动核算）
                </span>
                <span className="text-[11px] text-[#64748B]">
                  请在「穿透核查」或「回款与账龄」调整明细单据
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 tabular-nums pt-1">
                <div>
                  <span className="text-[11px] text-[#64748B]">
                    实际成本 ({editingProject.vouchers.length} 笔凭证)
                  </span>
                  <p className="font-bold text-[#0F172A] mt-0.5">
                    ¥{editingProject.metrics.actualCost.toFixed(1)}万
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-[#64748B]">累计已开票</span>
                  <p className="font-bold text-[#0F172A] mt-0.5">
                    ¥{editingProject.invoicedAmount.toFixed(1)}万
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-[#64748B]">累计已回款</span>
                  <p className="font-bold text-[#047857] mt-0.5">
                    ¥{editingProject.collectedAmount.toFixed(1)}万
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="pt-2 border-t border-slate-100">
              <span className="font-semibold text-[#0F172A] block mb-2.5">
                四大成本科目初始发生额 (自动生成初始化凭证，单位：万元)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[#475569]">人工工时</span>
                  <input
                    type="number"
                    step="0.1"
                    value={laborCost}
                    onChange={(e) => {
                      setLaborCost(e.target.value);
                      clearError('laborCost');
                    }}
                    className={`${inputClass('laborCost')} tabular-nums`}
                  />
                  {errors.laborCost && (
                    <span className="text-[11px] text-[#EF4444]">
                      {errors.laborCost}
                    </span>
                  )}
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[#475569]">软硬件采购</span>
                  <input
                    type="number"
                    step="0.1"
                    value={procurementCost}
                    onChange={(e) => {
                      setProcurementCost(e.target.value);
                      clearError('procurementCost');
                    }}
                    className={`${inputClass('procurementCost')} tabular-nums`}
                  />
                  {errors.procurementCost && (
                    <span className="text-[11px] text-[#EF4444]">
                      {errors.procurementCost}
                    </span>
                  )}
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[#475569]">外包技术</span>
                  <input
                    type="number"
                    step="0.1"
                    value={outsourcingCost}
                    onChange={(e) => {
                      setOutsourcingCost(e.target.value);
                      clearError('outsourcingCost');
                    }}
                    className={`${inputClass('outsourcingCost')} tabular-nums`}
                  />
                  {errors.outsourcingCost && (
                    <span className="text-[11px] text-[#EF4444]">
                      {errors.outsourcingCost}
                    </span>
                  )}
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[#475569]">差旅实施</span>
                  <input
                    type="number"
                    step="0.1"
                    value={travelCost}
                    onChange={(e) => {
                      setTravelCost(e.target.value);
                      clearError('travelCost');
                    }}
                    className={`${inputClass('travelCost')} tabular-nums`}
                  />
                  {errors.travelCost && (
                    <span className="text-[11px] text-[#EF4444]">
                      {errors.travelCost}
                    </span>
                  )}
                </label>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-[#475569] hover:bg-slate-50 cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold cursor-pointer"
            >
              {isEditMode ? '保存修改并同步全局' : '创建项目并入账'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
