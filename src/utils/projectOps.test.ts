import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_MOCK_PROJECTS } from '../data/mockProjects';
import { calcPortfolioSummary, calcProjectMetrics, enrichProjects } from './finance';
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
  validatePaymentRecordForm,
  validateProjectForm,
  validateVoucherForm,
} from './projectOps';

test('voucher add/edit/delete dynamically flips project over-budget status', () => {
  // prj-009: approvedBudget=260, actualCost=210 (normal -> not over budget)
  const base = INITIAL_MOCK_PROJECTS;
  const targetBefore = calcProjectMetrics(base.find((p) => p.id === 'prj-009')!);
  assert.equal(targetBefore.isOverBudget, false);
  assert.equal(targetBefore.actualCost, 210);

  // Add 80万 voucher -> actualCost becomes 290 > 260 (over budget!)
  const { projects: afterAdd, created } = addVoucherToProject(base, 'prj-009', {
    date: '2026-11-26',
    voucherNo: 'PZ-TEST-01',
    category: '软硬件采购',
    source: 'ERP',
    amountExclTax: 80,
    taxRate: 13,
    summary: '紧急增补硬件采购',
  });
  const afterAddMetrics = calcProjectMetrics(
    afterAdd.find((p) => p.id === 'prj-009')!
  );
  assert.equal(afterAddMetrics.actualCost, 290);
  assert.equal(afterAddMetrics.isOverBudget, true);
  assert.equal(afterAddMetrics.healthStatus, '超支');

  // Edit voucher down to 30万 -> actualCost becomes 240 <= 260 (back within budget!)
  const afterEdit = updateVoucherInProject(afterAdd, 'prj-009', created.id, {
    date: '2026-11-26',
    voucherNo: 'PZ-TEST-01',
    category: '软硬件采购',
    source: 'ERP',
    amountExclTax: 30,
    taxRate: 13,
    summary: '核减增补硬件采购',
  });
  const afterEditMetrics = calcProjectMetrics(
    afterEdit.find((p) => p.id === 'prj-009')!
  );
  assert.equal(afterEditMetrics.actualCost, 240);
  assert.equal(afterEditMetrics.isOverBudget, false);

  // Delete voucher -> actualCost returns to 210
  const afterDel = deleteVoucherFromProject(afterEdit, 'prj-009', created.id);
  const afterDelMetrics = calcProjectMetrics(
    afterDel.find((p) => p.id === 'prj-009')!
  );
  assert.equal(afterDelMetrics.actualCost, 210);
});

test('payment record CRUD recomputes invoiced, collected, and portfolio receivables', () => {
  // prj-009: invoiced=258, collected=108, uncollected=150, overdue=68
  const base = INITIAL_MOCK_PROJECTS;
  const { projects: afterCol, created } = addPaymentRecordToProject(
    base,
    'prj-009',
    {
      date: '2026-11-26',
      type: '回款',
      amount: 100,
      voucherNo: 'HK-2611-09',
      note: '大额尾款到账',
    }
  );
  const pAfterCol = afterCol.find((p) => p.id === 'prj-009')!;
  assert.equal(pAfterCol.collectedAmount, 208);
  assert.equal(calcProjectMetrics(pAfterCol).uncollectedReceivable, 50);

  // Edit collection to 150 -> fully collected, maxOverdueDays auto-clears to 0
  const afterFull = updatePaymentRecordInProject(
    afterCol,
    'prj-009',
    created.id,
    {
      date: '2026-11-26',
      type: '回款',
      amount: 150,
      voucherNo: 'HK-2611-09',
      note: '全部结清',
    }
  );
  const pFull = afterFull.find((p) => p.id === 'prj-009')!;
  assert.equal(pFull.collectedAmount, 258);
  assert.equal(pFull.maxOverdueDays, 0);

  // Portfolio summary reflects reduced overdue60PlusAmount
  const summaryBefore = calcPortfolioSummary(enrichProjects(base));
  const summaryAfter = calcPortfolioSummary(enrichProjects(afterFull));
  assert.equal(
    summaryAfter.overdue60PlusAmount,
    summaryBefore.overdue60PlusAmount - 150
  );

  // Delete payment record -> restores original collectedAmount
  const afterDel = deletePaymentRecordFromProject(
    afterFull,
    'prj-009',
    created.id
  );
  assert.equal(afterDel.find((p) => p.id === 'prj-009')!.collectedAmount, 108);
});

test('project duplicate, update, and undo-delete restoration work accurately', () => {
  const base = INITIAL_MOCK_PROJECTS;
  const nextCode = generateNextProjectCode(base);
  assert.equal(nextCode, 'PRJ-2026-028');

  const { projects: afterDup, duplicated } = duplicateProjectRecord(
    base,
    'prj-001'
  );
  assert.ok(duplicated);
  assert.equal(afterDup.length, base.length + 1);
  assert.equal(duplicated.code, 'PRJ-2026-028');
  assert.equal(duplicated.vouchers.length, base[0].vouchers.length);

  const updated = updateProjectFields(afterDup, duplicated.id, {
    progress: 120,
    approvedBudget: -10,
  });
  const target = updated.find((p) => p.id === duplicated.id)!;
  assert.equal(target.progress, 100);
  assert.equal(target.approvedBudget, 1);

  const withoutFirst = base.filter((p) => p.id !== 'prj-001');
  const restored = restoreProjectAtIndex(withoutFirst, base[0], 0);
  assert.equal(restored.length, base.length);
  assert.equal(restored[0].id, 'prj-001');
});

test('form validations reject missing required fields, negative amounts, and invalid progress', () => {
  const badProject = validateProjectForm(
    {
      code: '',
      name: '',
      client: '',
      milestone: '',
      businessGroup: '智慧能源组',
      manager: '',
      stage: '实施中',
      contractAmount: '-50',
      approvedBudget: '0',
      progress: '105',
      invoicedAmount: '-1',
      collectedAmount: 'NaN',
      maxOverdueDays: '-3',
      laborCost: '-2',
      procurementCost: '0',
      outsourcingCost: '0',
      travelCost: '0',
    },
    'create'
  );
  assert.equal(badProject.valid, false);
  assert.ok(badProject.errors.code);
  assert.ok(badProject.errors.name);
  assert.ok(badProject.errors.manager);
  assert.ok(badProject.errors.contractAmount);
  assert.ok(badProject.errors.approvedBudget);
  assert.ok(badProject.errors.progress);
  assert.ok(badProject.errors.invoicedAmount);
  assert.ok(badProject.errors.collectedAmount);
  assert.ok(badProject.errors.laborCost);

  const badVoucher = validateVoucherForm({
    date: '',
    voucherNo: '',
    category: '人工工时',
    source: 'HR',
    amountExclTax: '-10',
    taxRate: '0',
    summary: '',
  });
  assert.equal(badVoucher.valid, false);
  assert.ok(badVoucher.errors.amountExclTax);
  assert.ok(badVoucher.errors.summary);

  const badPayment = validatePaymentRecordForm({
    date: '2026-11-26',
    type: '回款',
    amount: '0',
    voucherNo: '',
    note: '',
  });
  assert.equal(badPayment.valid, false);
  assert.ok(badPayment.errors.amount);
  assert.ok(badPayment.errors.voucherNo);
});

test('normalizeProject upgrades legacy project without paymentRecords cleanly', () => {
  const legacy = {
    ...INITIAL_MOCK_PROJECTS[0],
    paymentRecords: undefined as unknown as [],
  };
  const norm = normalizeProject(legacy);
  assert.equal(norm.paymentRecords.length, 2);
  assert.equal(norm.invoicedAmount, INITIAL_MOCK_PROJECTS[0].invoicedAmount);
  assert.equal(norm.collectedAmount, INITIAL_MOCK_PROJECTS[0].collectedAmount);
});
