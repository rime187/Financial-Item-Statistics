import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  CostVoucher,
  EnrichedProject,
  PROJECT_STAGES,
  Project,
  ProjectStage,
} from '../types';
import { round1, round2 } from '../utils/finance';
import {
  buildInitialPaymentRecords,
  validateProjectForm,
} from '../utils/projectOps';
import { ModalDialog } from './ModalDialog';

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
  existingCodes: string[];
  onClose: () => void;
  onCreateProject: (project: Project) => void;
  onUpdateProject: (projectId: string, patch: ProjectEditPatch) => void;
  existingGroups: string[];
}

const CUSTOM_GROUP_SENTINEL = '__CUSTOM_GROUP__';

const FIELD_ORDER = [
  'code',
  'name',
  'manager',
  'contractAmount',
  'approvedBudget',
  'progress',
  'invoicedAmount',
  'collectedAmount',
  'maxOverdueDays',
  'laborCost',
  'procurementCost',
  'outsourcingCost',
  'travelCost',
];

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  editingProject,
  suggestedCode,
  existingCodes,
  onClose,
  onCreateProject,
  onUpdateProject,
  existingGroups,
}) => {
  const titleId = useId();
  const baseId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const lastEditRef = useRef<EnrichedProject | null>(editingProject);

  if (editingProject) {
    lastEditRef.current = editingProject;
  }

  const isEditMode = editingProject !== null;
  const displayEditingProject = isEditMode ? editingProject : null;

  const groupOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...existingGroups,
          '智慧能源组',
          '工业装备组',
          '自动化集成组',
          '数智底座组',
        ])
      ),
    [existingGroups]
  );

  const [code, setCode] = useState(suggestedCode);
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [milestone, setMilestone] = useState('上线初验款 (30%)');
  const [businessGroup, setBusinessGroup] = useState(
    groupOptions[0] || '智慧能源组'
  );
  const [customGroup, setCustomGroup] = useState('');
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
    setCustomGroup('');
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
      setBusinessGroup(groupOptions[0] || '智慧能源组');
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
  }, [isOpen, editingProject, suggestedCode, groupOptions]);

  const previewMetrics = useMemo(() => {
    const contract = Math.max(0, Number(contractAmount) || 0);
    const budget = Math.max(0, Number(approvedBudget) || 0);
    const prog = Math.min(100, Math.max(0, Number(progress) || 0));
    const inv = Math.max(0, Number(invoicedAmount) || 0);
    const col = Math.max(0, Number(collectedAmount) || 0);
    const initCost = isEditMode
      ? displayEditingProject?.metrics.actualCost ?? 0
      : round2(
          Math.max(0, Number(laborCost) || 0) +
            Math.max(0, Number(procurementCost) || 0) +
            Math.max(0, Number(outsourcingCost) || 0) +
            Math.max(0, Number(travelCost) || 0)
        );
    const recognizedRev = round2(contract * (prog / 100));
    const consumptionRate = budget > 0 ? (initCost / budget) * 100 : 0;
    const grossMargin =
      recognizedRev > 0 ? ((recognizedRev - initCost) / recognizedRev) * 100 : 0;
    const uncollected = isEditMode
      ? displayEditingProject?.metrics.uncollectedReceivable ?? 0
      : round2(Math.max(0, inv - col));
    return { initCost, consumptionRate, grossMargin, uncollected };
  }, [
    contractAmount,
    approvedBudget,
    progress,
    invoicedAmount,
    collectedAmount,
    laborCost,
    procurementCost,
    outsourcingCost,
    travelCost,
    isEditMode,
    displayEditingProject,
  ]);

  const isOverdueDisabled = previewMetrics.uncollected === 0;

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
    const otherCodes = editingProject
      ? existingCodes.filter(
          (c) => c.trim().toLowerCase() !== editingProject.code.trim().toLowerCase()
        )
      : existingCodes;

    const resolvedGroup =
      businessGroup === CUSTOM_GROUP_SENTINEL
        ? customGroup.trim() || '数智底座组'
        : businessGroup.trim() || '数智底座组';

    const validation = validateProjectForm(
      {
        code,
        name,
        client,
        milestone,
        businessGroup: resolvedGroup,
        manager,
        stage,
        contractAmount,
        approvedBudget,
        progress,
        invoicedAmount,
        collectedAmount,
        maxOverdueDays: isOverdueDisabled ? '0' : maxOverdueDays,
        laborCost,
        procurementCost,
        outsourcingCost,
        travelCost,
      },
      isEditMode ? 'edit' : 'create',
      otherCodes
    );

    if (!validation.valid) {
      setErrors(validation.errors);
      const firstInvalid = FIELD_ORDER.find((key) => validation.errors[key]);
      if (firstInvalid && formRef.current) {
        const target = formRef.current.querySelector<HTMLElement>(
          `[name="${firstInvalid}"]`
        );
        target?.focus();
      }
      return;
    }

    if (isEditMode && editingProject) {
      onUpdateProject(editingProject.id, {
        code: code.trim(),
        name: name.trim(),
        client: client.trim() || '重点企业客户',
        milestone: milestone.trim() || '阶段进度款',
        businessGroup: resolvedGroup,
        manager: manager.trim(),
        stage,
        contractAmount: round1(Number(contractAmount)),
        approvedBudget: Math.max(1, round1(Number(approvedBudget))),
        progress: Math.min(100, Math.max(0, Math.round(Number(progress)))),
        maxOverdueDays: isOverdueDisabled
          ? 0
          : Math.max(0, Math.round(Number(maxOverdueDays))),
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
          amountExclTax: round2(amount),
          taxRate,
          summary: `立项初始化${category}成本归集`,
        });
      }
    };

    addInit('人工工时', 'HR', 0, Number(laborCost) || 0, 1);
    addInit('软硬件采购', 'ERP', 13, Number(procurementCost) || 0, 2);
    addInit('外包技术', 'OA', 6, Number(outsourcingCost) || 0, 3);
    addInit('差旅实施', 'OA', 6, Number(travelCost) || 0, 4);

    const inv = round2(Number(invoicedAmount) || 0);
    const col = round2(Number(collectedAmount) || 0);
    const ms = milestone.trim() || '阶段进度款';

    onCreateProject({
      id,
      code: code.trim(),
      name: name.trim(),
      client: client.trim() || '重点企业客户',
      milestone: ms,
      businessGroup: resolvedGroup,
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

  const fieldId = (field: string) => `${baseId}-${field}`;
  const errorId = (field: string) => `${baseId}-${field}-err`;

  const inputClass = (field: string) =>
    `px-3 py-2 rounded-lg border text-xs transition-colors ${
      errors[field]
        ? 'border-[#EF4444] bg-[#FEF2F2]/40'
        : 'border-slate-200 bg-white hover:border-slate-300'
    }`;

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      variant="modal"
      maxWidth="44rem"
      ariaLabelledBy={titleId}
      closedBy="any"
    >
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
        <div>
          <h1 id={titleId} className="text-base font-bold text-[#0F172A]">
            {isEditMode ? '编辑项目财务档案' : '新增项目财务台账'}
          </h1>
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
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        noValidate
        className="p-6 overflow-y-auto panel-scroll flex flex-col gap-5 text-xs"
      >
        {/* Basic Info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={fieldId('code')} className="font-medium text-[#475569]">
              项目编号 <span aria-hidden="true">*</span>
            </label>
            <input
              id={fieldId('code')}
              name="code"
              type="text"
              required
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              value={code}
              aria-invalid={errors.code ? 'true' : undefined}
              aria-describedby={errors.code ? errorId('code') : undefined}
              onChange={(e) => {
                setCode(e.target.value);
                clearError('code');
              }}
              className={`${inputClass('code')} tabular-nums`}
            />
            {errors.code && (
              <span id={errorId('code')} className="text-[11px] text-[#EF4444]">
                {errors.code}
              </span>
            )}
          </div>

          <div className="sm:col-span-2 flex flex-col gap-1">
            <label htmlFor={fieldId('name')} className="font-medium text-[#475569]">
              项目名称 <span aria-hidden="true">*</span>
            </label>
            <input
              id={fieldId('name')}
              name="name"
              type="text"
              required
              autoFocus={!isEditMode}
              placeholder="例如：华南智能微电网调度系统"
              value={name}
              aria-invalid={errors.name ? 'true' : undefined}
              aria-describedby={errors.name ? errorId('name') : undefined}
              onChange={(e) => {
                setName(e.target.value);
                clearError('name');
              }}
              className={inputClass('name')}
            />
            {errors.name && (
              <span id={errorId('name')} className="text-[11px] text-[#EF4444]">
                {errors.name}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={fieldId('businessGroup')} className="font-medium text-[#475569]">
              所属业务组
            </label>
            <select
              id={fieldId('businessGroup')}
              name="businessGroup"
              value={businessGroup}
              onChange={(e) => setBusinessGroup(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:border-slate-300"
            >
              {groupOptions.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
              <option value={CUSTOM_GROUP_SENTINEL}>+ 自定义新业务组...</option>
            </select>
            {businessGroup === CUSTOM_GROUP_SENTINEL && (
              <input
                type="text"
                aria-label="自定义业务组名称"
                placeholder="输入新业务组名称"
                value={customGroup}
                onChange={(e) => setCustomGroup(e.target.value)}
                className="mt-1 px-3 py-1.5 rounded-lg border border-blue-200 bg-[#EFF6FF]/30 text-xs"
              />
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={fieldId('manager')} className="font-medium text-[#475569]">
              负责人 <span aria-hidden="true">*</span>
            </label>
            <input
              id={fieldId('manager')}
              name="manager"
              type="text"
              required
              placeholder="姓名"
              value={manager}
              aria-invalid={errors.manager ? 'true' : undefined}
              aria-describedby={errors.manager ? errorId('manager') : undefined}
              onChange={(e) => {
                setManager(e.target.value);
                clearError('manager');
              }}
              className={inputClass('manager')}
            />
            {errors.manager && (
              <span id={errorId('manager')} className="text-[11px] text-[#EF4444]">
                {errors.manager}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={fieldId('stage')} className="font-medium text-[#475569]">
              当前阶段
            </label>
            <select
              id={fieldId('stage')}
              name="stage"
              value={stage}
              onChange={(e) => setStage(e.target.value as ProjectStage)}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:border-slate-300"
            >
              {PROJECT_STAGES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={fieldId('client')} className="font-medium text-[#475569]">
              客户名称
            </label>
            <input
              id={fieldId('client')}
              name="client"
              type="text"
              placeholder="企业/园区名称"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:border-slate-300"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={fieldId('milestone')} className="font-medium text-[#475569]">
              当前收款节点
            </label>
            <input
              id={fieldId('milestone')}
              name="milestone"
              type="text"
              value={milestone}
              onChange={(e) => setMilestone(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:border-slate-300"
            />
          </div>
        </div>

        {/* Financials */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-col gap-1">
            <label htmlFor={fieldId('contractAmount')} className="font-medium text-[#475569]">
              合同额 (万元) <span aria-hidden="true">*</span>
            </label>
            <input
              id={fieldId('contractAmount')}
              name="contractAmount"
              type="number"
              inputMode="decimal"
              step="0.1"
              required
              value={contractAmount}
              aria-invalid={errors.contractAmount ? 'true' : undefined}
              aria-describedby={
                errors.contractAmount ? errorId('contractAmount') : undefined
              }
              onChange={(e) => {
                setContractAmount(e.target.value);
                clearError('contractAmount');
              }}
              className={`${inputClass('contractAmount')} tabular-nums`}
            />
            {errors.contractAmount && (
              <span
                id={errorId('contractAmount')}
                className="text-[11px] text-[#EF4444]"
              >
                {errors.contractAmount}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={fieldId('approvedBudget')} className="font-medium text-[#475569]">
              核定预算 (万元) <span aria-hidden="true">*</span>
            </label>
            <input
              id={fieldId('approvedBudget')}
              name="approvedBudget"
              type="number"
              inputMode="decimal"
              step="0.1"
              required
              value={approvedBudget}
              aria-invalid={errors.approvedBudget ? 'true' : undefined}
              aria-describedby={
                errors.approvedBudget ? errorId('approvedBudget') : undefined
              }
              onChange={(e) => {
                setApprovedBudget(e.target.value);
                clearError('approvedBudget');
              }}
              className={`${inputClass('approvedBudget')} tabular-nums`}
            />
            {errors.approvedBudget && (
              <span
                id={errorId('approvedBudget')}
                className="text-[11px] text-[#EF4444]"
              >
                {errors.approvedBudget}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={fieldId('progress')} className="font-medium text-[#475569]">
              完工进度 (0~100%) <span aria-hidden="true">*</span>
            </label>
            <input
              id={fieldId('progress')}
              name="progress"
              type="number"
              inputMode="numeric"
              step="1"
              required
              value={progress}
              aria-invalid={errors.progress ? 'true' : undefined}
              aria-describedby={errors.progress ? errorId('progress') : undefined}
              onChange={(e) => {
                setProgress(e.target.value);
                clearError('progress');
              }}
              className={`${inputClass('progress')} tabular-nums`}
            />
            {errors.progress && (
              <span id={errorId('progress')} className="text-[11px] text-[#EF4444]">
                {errors.progress}
              </span>
            )}
          </div>

          {!isEditMode && (
            <>
              <div className="flex flex-col gap-1">
                <label htmlFor={fieldId('invoicedAmount')} className="font-medium text-[#475569]">
                  已开票 (万元)
                </label>
                <input
                  id={fieldId('invoicedAmount')}
                  name="invoicedAmount"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={invoicedAmount}
                  aria-invalid={errors.invoicedAmount ? 'true' : undefined}
                  aria-describedby={
                    errors.invoicedAmount ? errorId('invoicedAmount') : undefined
                  }
                  onChange={(e) => {
                    setInvoicedAmount(e.target.value);
                    clearError('invoicedAmount');
                  }}
                  className={`${inputClass('invoicedAmount')} tabular-nums`}
                />
                {errors.invoicedAmount && (
                  <span
                    id={errorId('invoicedAmount')}
                    className="text-[11px] text-[#EF4444]"
                  >
                    {errors.invoicedAmount}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor={fieldId('collectedAmount')} className="font-medium text-[#475569]">
                  已回款 (万元)
                </label>
                <input
                  id={fieldId('collectedAmount')}
                  name="collectedAmount"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={collectedAmount}
                  aria-invalid={errors.collectedAmount ? 'true' : undefined}
                  aria-describedby={
                    errors.collectedAmount ? errorId('collectedAmount') : undefined
                  }
                  onChange={(e) => {
                    setCollectedAmount(e.target.value);
                    clearError('collectedAmount');
                  }}
                  className={`${inputClass('collectedAmount')} tabular-nums`}
                />
                {errors.collectedAmount && (
                  <span
                    id={errorId('collectedAmount')}
                    className="text-[11px] text-[#EF4444]"
                  >
                    {errors.collectedAmount}
                  </span>
                )}
              </div>
            </>
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor={fieldId('maxOverdueDays')} className="font-medium text-[#475569]">
              最长逾期 (天)
            </label>
            <input
              id={fieldId('maxOverdueDays')}
              name="maxOverdueDays"
              type="number"
              inputMode="numeric"
              step="1"
              disabled={isOverdueDisabled}
              value={isOverdueDisabled ? '0' : maxOverdueDays}
              aria-invalid={errors.maxOverdueDays ? 'true' : undefined}
              aria-describedby={
                errors.maxOverdueDays
                  ? errorId('maxOverdueDays')
                  : isOverdueDisabled
                    ? `${baseId}-overdue-hint`
                    : undefined
              }
              onChange={(e) => {
                setMaxOverdueDays(e.target.value);
                clearError('maxOverdueDays');
              }}
              className={`${inputClass('maxOverdueDays')} tabular-nums ${
                isOverdueDisabled ? 'bg-slate-50 text-[#94A3B8] cursor-not-allowed' : ''
              }`}
            />
            {isOverdueDisabled ? (
              <span
                id={`${baseId}-overdue-hint`}
                className="text-[11px] text-[#64748B]"
              >
                无未回应收，自动归零
              </span>
            ) : (
              errors.maxOverdueDays && (
                <span
                  id={errorId('maxOverdueDays')}
                  className="text-[11px] text-[#EF4444]"
                >
                  {errors.maxOverdueDays}
                </span>
              )
            )}
          </div>
        </div>

        {/* Create Mode: Initial Cost Categories | Edit Mode: Read-Only Sub-ledger Summary */}
        {isEditMode && displayEditingProject ? (
          <div className="rounded-xl bg-[#F8FAFC] border border-slate-200/80 p-3.5 flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
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
                  实际成本 ({displayEditingProject.vouchers.length} 笔凭证)
                </span>
                <p className="font-bold text-[#0F172A] mt-0.5">
                  ¥{displayEditingProject.metrics.actualCost.toFixed(1)}万
                </p>
              </div>
              <div>
                <span className="text-[11px] text-[#64748B]">累计已开票</span>
                <p className="font-bold text-[#0F172A] mt-0.5">
                  ¥{displayEditingProject.invoicedAmount.toFixed(1)}万
                </p>
              </div>
              <div>
                <span className="text-[11px] text-[#64748B]">累计已回款</span>
                <p className="font-bold text-[#047857] mt-0.5">
                  ¥{displayEditingProject.collectedAmount.toFixed(1)}万
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="pt-2 border-t border-slate-100 flex flex-col gap-3">
            <span className="font-semibold text-[#0F172A] block">
              四大成本科目初始发生额 (自动生成初始化凭证，单位：万元)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  key: 'laborCost',
                  label: '人工工时',
                  value: laborCost,
                  setter: setLaborCost,
                },
                {
                  key: 'procurementCost',
                  label: '软硬件采购',
                  value: procurementCost,
                  setter: setProcurementCost,
                },
                {
                  key: 'outsourcingCost',
                  label: '外包技术',
                  value: outsourcingCost,
                  setter: setOutsourcingCost,
                },
                {
                  key: 'travelCost',
                  label: '差旅实施',
                  value: travelCost,
                  setter: setTravelCost,
                },
              ].map((item) => (
                <div key={item.key} className="flex flex-col gap-1">
                  <label htmlFor={fieldId(item.key)} className="text-[#475569]">
                    {item.label}
                  </label>
                  <input
                    id={fieldId(item.key)}
                    name={item.key}
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={item.value}
                    aria-invalid={errors[item.key] ? 'true' : undefined}
                    aria-describedby={
                      errors[item.key] ? errorId(item.key) : undefined
                    }
                    onChange={(e) => {
                      item.setter(e.target.value);
                      clearError(item.key);
                    }}
                    className={`${inputClass(item.key)} tabular-nums`}
                  />
                  {errors[item.key] && (
                    <span
                      id={errorId(item.key)}
                      className="text-[11px] text-[#EF4444]"
                    >
                      {errors[item.key]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live Calculated Financial Preview Strip */}
        <div className="rounded-xl bg-[#F8FAFC] border border-slate-200/80 px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
          <div>
            <span className="text-[11px] text-[#64748B]">
              {isEditMode ? '当前实际成本' : '初始合计成本'}
            </span>
            <p className="font-bold text-[#0F172A] mt-0.5">
              ¥{previewMetrics.initCost.toFixed(1)}万
            </p>
          </div>
          <div>
            <span className="text-[11px] text-[#64748B]">预计预算消耗率</span>
            <p
              className={`font-bold mt-0.5 ${
                previewMetrics.consumptionRate > 100
                  ? 'text-[#EF4444]'
                  : 'text-[#2563EB]'
              }`}
            >
              {previewMetrics.consumptionRate.toFixed(1)}%
            </p>
          </div>
          <div>
            <span className="text-[11px] text-[#64748B]">预计核算毛利率</span>
            <p
              className={`font-bold mt-0.5 ${
                previewMetrics.grossMargin < 32
                  ? 'text-[#F59E0B]'
                  : 'text-[#10B981]'
              }`}
            >
              {previewMetrics.grossMargin.toFixed(1)}%
            </p>
          </div>
          <div>
            <span className="text-[11px] text-[#64748B]">应收未回余额</span>
            <p
              className={`font-bold mt-0.5 ${
                previewMetrics.uncollected > 0
                  ? 'text-[#B45309]'
                  : 'text-[#047857]'
              }`}
            >
              ¥{previewMetrics.uncollected.toFixed(1)}万
            </p>
          </div>
        </div>

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
    </ModalDialog>
  );
};
