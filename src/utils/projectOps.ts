import {
  CostCategory,
  CostVoucher,
  PaymentRecord,
  PaymentRecordType,
  Project,
  ProjectStage,
  VoucherSource,
} from '../types';
import { round1, round2 } from './finance';

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/**
 * Synthesize initial payment records when migrating legacy localStorage items
 * or CSV imports that only carry aggregate invoicedAmount / collectedAmount.
 */
export function buildInitialPaymentRecords(
  projectId: string,
  invoicedAmount: number,
  collectedAmount: number,
  milestone: string,
  date = new Date().toISOString().slice(0, 10)
): PaymentRecord[] {
  const records: PaymentRecord[] = [];
  if (invoicedAmount > 0) {
    records.push({
      id: `${projectId}-pay-inv-1`,
      date,
      type: '开票',
      amount: round2(invoicedAmount),
      voucherNo: `FP-${projectId.slice(-3).toUpperCase()}-01`,
      note: `${milestone || '阶段进度款'}开票登记`,
    });
  }
  if (collectedAmount > 0) {
    records.push({
      id: `${projectId}-pay-col-1`,
      date,
      type: '回款',
      amount: round2(collectedAmount),
      voucherNo: `HK-${projectId.slice(-3).toUpperCase()}-01`,
      note: `${milestone || '阶段进度款'}银行到账回款`,
    });
  }
  return records;
}

/**
 * Recomputes invoicedAmount and collectedAmount directly from paymentRecords
 * to preserve single-source-of-truth ledger integrity.
 */
export function syncBillingFromRecords(project: Project): Project {
  const invoicedAmount = round1(
    project.paymentRecords
      .filter((r) => r.type === '开票')
      .reduce((sum, r) => sum + r.amount, 0)
  );
  const collectedAmount = round1(
    project.paymentRecords
      .filter((r) => r.type === '回款')
      .reduce((sum, r) => sum + r.amount, 0)
  );
  const uncollected = Math.max(0, invoicedAmount - collectedAmount);

  return {
    ...project,
    invoicedAmount,
    collectedAmount,
    maxOverdueDays: uncollected === 0 ? 0 : Math.max(0, Math.round(project.maxOverdueDays)),
  };
}

/**
 * Normalizes a persisted or imported Project so paymentRecords and numeric fields
 * are always valid and free of NaN.
 */
export function normalizeProject(raw: Partial<Project> & { id: string }): Project {
  const safeNum = (v: unknown, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  const invoicedFallback = round1(safeNum(raw.invoicedAmount, 0));
  const collectedFallback = round1(safeNum(raw.collectedAmount, 0));
  const milestone = raw.milestone || '阶段进度款';

  const paymentRecords: PaymentRecord[] = Array.isArray(raw.paymentRecords)
    ? raw.paymentRecords.map((r, idx) => ({
        id: r.id || `${raw.id}-pay-${idx + 1}`,
        date: r.date || new Date().toISOString().slice(0, 10),
        type: r.type === '回款' ? '回款' : '开票',
        amount: round2(safeNum(r.amount, 0)),
        voucherNo: r.voucherNo || `REC-${idx + 1}`,
        note: r.note || '',
      }))
    : buildInitialPaymentRecords(raw.id, invoicedFallback, collectedFallback, milestone);

  const vouchers: CostVoucher[] = Array.isArray(raw.vouchers)
    ? raw.vouchers.map((v, idx) => ({
        id: v.id || `${raw.id}-v-${idx + 1}`,
        date: v.date || new Date().toISOString().slice(0, 10),
        voucherNo: v.voucherNo || `PZ-${idx + 1}`,
        category: v.category || '人工工时',
        source: v.source || '手工',
        amountExclTax: round2(safeNum(v.amountExclTax, 0)),
        taxRate: safeNum(v.taxRate, 0),
        summary: v.summary || '',
      }))
    : [];

  const base: Project = {
    id: raw.id,
    code: raw.code || 'PRJ-2026-000',
    name: raw.name || '未命名项目',
    client: raw.client || '重点企业客户',
    milestone,
    businessGroup: raw.businessGroup || '数智底座组',
    manager: raw.manager || '待指派',
    stage: raw.stage || '实施中',
    contractAmount: round1(safeNum(raw.contractAmount, 0)),
    approvedBudget: Math.max(1, round1(safeNum(raw.approvedBudget, 1))),
    progress: Math.min(100, Math.max(0, Math.round(safeNum(raw.progress, 0)))),
    invoicedAmount: invoicedFallback,
    collectedAmount: collectedFallback,
    maxOverdueDays: Math.max(0, Math.round(safeNum(raw.maxOverdueDays, 0))),
    vouchers,
    paymentRecords,
  };

  return Array.isArray(raw.paymentRecords) ? syncBillingFromRecords(base) : base;
}

/**
 * Generates the next sequential project code such as PRJ-2026-009 / PRJ-2026-028.
 */
export function generateNextProjectCode(projects: Project[]): string {
  const year = 2026;
  let maxSeq = 0;
  for (const p of projects) {
    const m = p.code.match(/PRJ-\d{4}-(\d+)/i);
    if (m) {
      const seq = Number(m[1]);
      if (Number.isFinite(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }
  const next = Math.max(projects.length + 1, maxSeq + 1);
  return `PRJ-${year}-${String(next).padStart(3, '0')}`;
}

export interface ProjectFormInput {
  code: string;
  name: string;
  client: string;
  milestone: string;
  businessGroup: string;
  manager: string;
  stage: ProjectStage;
  contractAmount: string;
  approvedBudget: string;
  progress: string;
  invoicedAmount?: string;
  collectedAmount?: string;
  maxOverdueDays: string;
  laborCost?: string;
  procurementCost?: string;
  outsourcingCost?: string;
  travelCost?: string;
}

export function validateProjectForm(
  input: ProjectFormInput,
  mode: 'create' | 'edit'
): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.code.trim()) errors.code = '请填写项目编号';
  if (!input.name.trim()) errors.name = '请填写项目名称';
  if (!input.manager.trim()) errors.manager = '请填写项目负责人';

  const checkNonNegative = (key: string, val: string | undefined, label: string, min = 0) => {
    const raw = (val ?? '').trim();
    if (raw === '') {
      errors[key] = `请填写${label}`;
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      errors[key] = `${label}必须为有效数字`;
    } else if (n < min) {
      errors[key] = min > 0 ? `${label}必须大于等于 ${min}` : `${label}不可为负数`;
    }
  };

  checkNonNegative('contractAmount', input.contractAmount, '合同额', 0);
  checkNonNegative('approvedBudget', input.approvedBudget, '核定预算', 1);

  const progRaw = input.progress.trim();
  const progNum = Number(progRaw);
  if (progRaw === '' || !Number.isFinite(progNum)) {
    errors.progress = '请填写有效完工进度';
  } else if (progNum < 0 || progNum > 100) {
    errors.progress = '完工进度须在 0~100 之间';
  }

  checkNonNegative('maxOverdueDays', input.maxOverdueDays, '最长逾期天数', 0);

  if (mode === 'create') {
    checkNonNegative('invoicedAmount', input.invoicedAmount ?? '0', '已开票金额', 0);
    checkNonNegative('collectedAmount', input.collectedAmount ?? '0', '已回款金额', 0);
    checkNonNegative('laborCost', input.laborCost ?? '0', '人工工时', 0);
    checkNonNegative('procurementCost', input.procurementCost ?? '0', '软硬件采购', 0);
    checkNonNegative('outsourcingCost', input.outsourcingCost ?? '0', '外包技术', 0);
    checkNonNegative('travelCost', input.travelCost ?? '0', '差旅实施', 0);
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export interface VoucherFormInput {
  date: string;
  voucherNo: string;
  category: CostCategory;
  source: VoucherSource;
  amountExclTax: string;
  taxRate: string;
  summary: string;
}

export function validateVoucherForm(input: VoucherFormInput): ValidationResult {
  const errors: Record<string, string> = {};
  if (!input.date.trim()) errors.date = '请选择入账日期';
  if (!input.voucherNo.trim()) errors.voucherNo = '请填写凭证号';

  const amt = Number(input.amountExclTax);
  if (input.amountExclTax.trim() === '' || !Number.isFinite(amt)) {
    errors.amountExclTax = '请输入有效金额';
  } else if (amt <= 0) {
    errors.amountExclTax = '凭证金额必须大于 0';
  }

  const tax = Number(input.taxRate);
  if (!Number.isFinite(tax) || tax < 0 || tax > 100) {
    errors.taxRate = '税率须在 0~100 之间';
  }

  if (!input.summary.trim()) errors.summary = '请填写摘要说明';

  return { valid: Object.keys(errors).length === 0, errors };
}

export interface PaymentRecordFormInput {
  date: string;
  type: PaymentRecordType;
  amount: string;
  voucherNo: string;
  note: string;
}

export function validatePaymentRecordForm(
  input: PaymentRecordFormInput
): ValidationResult {
  const errors: Record<string, string> = {};
  if (!input.date.trim()) errors.date = '请选择日期';

  const amt = Number(input.amount);
  if (input.amount.trim() === '' || !Number.isFinite(amt)) {
    errors.amount = '请输入有效金额';
  } else if (amt <= 0) {
    errors.amount = '金额必须大于 0';
  }

  if (!input.voucherNo.trim()) errors.voucherNo = '请填写单据/发票号';
  if (!input.note.trim()) errors.note = '请填写收款节点或摘要';

  return { valid: Object.keys(errors).length === 0, errors };
}

/* ==================== Pure CRUD Reducers ==================== */

export function updateProjectFields(
  projects: Project[],
  projectId: string,
  patch: Partial<
    Pick<
      Project,
      | 'code'
      | 'name'
      | 'client'
      | 'milestone'
      | 'businessGroup'
      | 'manager'
      | 'stage'
      | 'contractAmount'
      | 'approvedBudget'
      | 'progress'
      | 'maxOverdueDays'
    >
  >
): Project[] {
  return projects.map((p) => {
    if (p.id !== projectId) return p;
    return {
      ...p,
      ...patch,
      approvedBudget:
        patch.approvedBudget !== undefined
          ? Math.max(1, round1(patch.approvedBudget))
          : p.approvedBudget,
      contractAmount:
        patch.contractAmount !== undefined
          ? Math.max(0, round1(patch.contractAmount))
          : p.contractAmount,
      progress:
        patch.progress !== undefined
          ? Math.min(100, Math.max(0, Math.round(patch.progress)))
          : p.progress,
      maxOverdueDays:
        patch.maxOverdueDays !== undefined
          ? Math.max(0, Math.round(patch.maxOverdueDays))
          : p.maxOverdueDays,
    };
  });
}

export function duplicateProjectRecord(
  projects: Project[],
  projectId: string
): { projects: Project[]; duplicated: Project | null } {
  const targetIdx = projects.findIndex((p) => p.id === projectId);
  if (targetIdx < 0) return { projects, duplicated: null };

  const source = projects[targetIdx];
  const newId = `prj-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
  const nextCode = generateNextProjectCode(projects);

  const duplicated: Project = {
    ...source,
    id: newId,
    code: nextCode,
    name: `${source.name} (副本)`,
    vouchers: source.vouchers.map((v, idx) => ({
      ...v,
      id: `${newId}-v-${idx + 1}`,
    })),
    paymentRecords: source.paymentRecords.map((r, idx) => ({
      ...r,
      id: `${newId}-pay-${idx + 1}`,
    })),
  };

  const next = [...projects];
  next.splice(targetIdx + 1, 0, duplicated);
  return { projects: next, duplicated };
}

export function restoreProjectAtIndex(
  projects: Project[],
  project: Project,
  index: number
): Project[] {
  if (projects.some((p) => p.id === project.id)) return projects;
  const clampedIdx = Math.max(0, Math.min(projects.length, index));
  const next = [...projects];
  next.splice(clampedIdx, 0, project);
  return next;
}

export function addVoucherToProject(
  projects: Project[],
  projectId: string,
  voucher: Omit<CostVoucher, 'id'>
): { projects: Project[]; created: CostVoucher } {
  const created: CostVoucher = {
    ...voucher,
    id: `v-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    amountExclTax: round2(Math.max(0, voucher.amountExclTax)),
  };
  return {
    created,
    projects: projects.map((p) =>
      p.id === projectId ? { ...p, vouchers: [created, ...p.vouchers] } : p
    ),
  };
}

export function updateVoucherInProject(
  projects: Project[],
  projectId: string,
  voucherId: string,
  patch: Omit<CostVoucher, 'id'>
): Project[] {
  return projects.map((p) => {
    if (p.id !== projectId) return p;
    return {
      ...p,
      vouchers: p.vouchers.map((v) =>
        v.id === voucherId
          ? {
              ...v,
              ...patch,
              amountExclTax: round2(Math.max(0, patch.amountExclTax)),
            }
          : v
      ),
    };
  });
}

export function deleteVoucherFromProject(
  projects: Project[],
  projectId: string,
  voucherId: string
): Project[] {
  return projects.map((p) =>
    p.id === projectId
      ? { ...p, vouchers: p.vouchers.filter((v) => v.id !== voucherId) }
      : p
  );
}

export function addPaymentRecordToProject(
  projects: Project[],
  projectId: string,
  record: Omit<PaymentRecord, 'id'>
): { projects: Project[]; created: PaymentRecord } {
  const created: PaymentRecord = {
    ...record,
    id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    amount: round2(Math.max(0, record.amount)),
  };
  return {
    created,
    projects: projects.map((p) => {
      if (p.id !== projectId) return p;
      return syncBillingFromRecords({
        ...p,
        paymentRecords: [created, ...p.paymentRecords],
      });
    }),
  };
}

export function updatePaymentRecordInProject(
  projects: Project[],
  projectId: string,
  recordId: string,
  patch: Omit<PaymentRecord, 'id'>
): Project[] {
  return projects.map((p) => {
    if (p.id !== projectId) return p;
    return syncBillingFromRecords({
      ...p,
      paymentRecords: p.paymentRecords.map((r) =>
        r.id === recordId
          ? {
              ...r,
              ...patch,
              amount: round2(Math.max(0, patch.amount)),
            }
          : r
      ),
    });
  });
}

export function deletePaymentRecordFromProject(
  projects: Project[],
  projectId: string,
  recordId: string
): Project[] {
  return projects.map((p) => {
    if (p.id !== projectId) return p;
    return syncBillingFromRecords({
      ...p,
      paymentRecords: p.paymentRecords.filter((r) => r.id !== recordId),
    });
  });
}
