import { CostVoucher, EnrichedProject, Project, ProjectStage } from '../types';
import { buildInitialPaymentRecords } from './projectOps';

const CSV_HEADERS = [
  '项目编号',
  '项目名称',
  '客户名称',
  '收款节点',
  '业务组',
  '负责人',
  '阶段',
  '合同额(万)',
  '核定预算(万)',
  '完工进度(%)',
  '累计已开票(万)',
  '累计已回款(万)',
  '最长逾期天数',
  '人工工时(万)',
  '软硬件采购(万)',
  '外包技术(万)',
  '差旅实施(万)',
];

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function triggerDownload(filename: string, csvContent: string): void {
  // Always prepend UTF-8 BOM so Windows Excel opens Chinese characters cleanly
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadCsvTemplate(): void {
  const sampleRows = [
    [
      'PRJ-2026-031',
      '南京智能制造车间MES升级',
      '金陵精工科技有限公司',
      '初验验收款 (30%)',
      '数智底座组',
      '周晨',
      '实施中',
      '260.0',
      '175.0',
      '65',
      '130.0',
      '104.0',
      '15',
      '62.5',
      '28.0',
      '12.0',
      '4.5',
    ],
    [
      'PRJ-2026-032',
      '广州南沙码头岸桥远程控制',
      '南沙港务集团有限公司',
      '质保验收款 (10%)',
      '自动化集成组',
      '吴浩',
      '试运行',
      '320.0',
      '215.0',
      '88',
      '256.0',
      '192.0',
      '45',
      '98.0',
      '54.0',
      '26.0',
      '8.0',
    ],
  ];

  const lines = [
    CSV_HEADERS.map(escapeCsvCell).join(','),
    ...sampleRows.map((row) => row.map(escapeCsvCell).join(',')),
  ];

  triggerDownload('项目财务台账导入模板.csv', lines.join('\r\n'));
}

export function exportProjectsReportCsv(projects: EnrichedProject[]): void {
  const reportHeaders = [
    '项目编号',
    '项目名称',
    '客户名称',
    '收款节点',
    '业务组',
    '负责人',
    '阶段',
    '合同额(万)',
    '核定预算(万)',
    '完工进度(%)',
    '人工工时(万)',
    '软硬件采购(万)',
    '外包技术(万)',
    '差旅实施(万)',
    '实际总成本(万)',
    '预算消耗率(%)',
    '已确认产值(万)',
    '核算毛利率(%)',
    '累计已开票(万)',
    '累计已回款(万)',
    '应收未回(万)',
    '最长逾期天数',
    '健康状态',
  ];

  const rows = projects.map((p) => [
    p.code,
    p.name,
    p.client,
    p.milestone,
    p.businessGroup,
    p.manager,
    p.stage,
    p.contractAmount.toFixed(1),
    p.approvedBudget.toFixed(1),
    p.progress.toFixed(0),
    p.metrics.categoryCosts.labor.toFixed(2),
    p.metrics.categoryCosts.procurement.toFixed(2),
    p.metrics.categoryCosts.outsourcing.toFixed(2),
    p.metrics.categoryCosts.travel.toFixed(2),
    p.metrics.actualCost.toFixed(2),
    p.metrics.budgetConsumptionRate.toFixed(1),
    p.metrics.recognizedRevenue.toFixed(1),
    p.metrics.grossMargin.toFixed(1),
    p.invoicedAmount.toFixed(2),
    p.collectedAmount.toFixed(2),
    p.metrics.uncollectedReceivable.toFixed(2),
    p.maxOverdueDays,
    p.metrics.healthStatus,
  ]);

  const lines = [
    reportHeaders.map(escapeCsvCell).join(','),
    ...rows.map((r) => r.map(escapeCsvCell).join(',')),
  ];

  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  triggerDownload(`项目财务成本报表_${y}${m}${d}.csv`, lines.join('\r\n'));
}

export function exportProjectVouchersCsv(project: EnrichedProject): void {
  const headers = [
    '项目编号',
    '项目名称',
    '入账日期',
    '凭证号',
    '成本科目',
    '单据来源',
    '不含税金额(万)',
    '税率(%)',
    '含税金额(万)',
    '摘要说明',
  ];

  const rows = project.vouchers.map((v) => [
    project.code,
    project.name,
    v.date,
    v.voucherNo,
    v.category,
    v.source,
    v.amountExclTax.toFixed(2),
    v.taxRate,
    (v.amountExclTax * (1 + v.taxRate / 100)).toFixed(2),
    v.summary,
  ]);

  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((r) => r.map(escapeCsvCell).join(',')),
  ];

  triggerDownload(`${project.code}_成本凭证明细.csv`, lines.join('\r\n'));
}

function parseCsvMatrix(rawText: string): string[][] {
  // Strip UTF-8 BOM if present
  const text = rawText.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(cell.trim());
        cell = '';
      } else if (ch === '\r' && next === '\n') {
        row.push(cell.trim());
        if (row.some((c) => c !== '')) rows.push(row);
        row = [];
        cell = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        row.push(cell.trim());
        if (row.some((c) => c !== '')) rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += ch;
      }
    }
  }

  if (cell !== '' || row.length > 0) {
    row.push(cell.trim());
    if (row.some((c) => c !== '')) rows.push(row);
  }

  return rows;
}

function parseNumber(val: string | undefined, fallback = 0): number {
  if (!val) return fallback;
  const cleaned = val.replace(/[¥￥,\s%万]/g, '');
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeStage(val: string | undefined): ProjectStage {
  if (val === '立项中' || val === '实施中' || val === '试运行' || val === '已验收') {
    return val;
  }
  return '实施中';
}

export interface CsvImportResult {
  projects: Project[];
  addedCount: number;
  updatedCount: number;
  skippedCount: number;
  skippedReasons: string[];
}

export function importProjectsFromCsvText(
  csvText: string,
  existingProjects: Project[]
): CsvImportResult {
  const matrix = parseCsvMatrix(csvText);
  if (matrix.length < 2) {
    return {
      projects: existingProjects,
      addedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      skippedReasons: ['CSV 内容为空或缺少数据行'],
    };
  }

  const headerRow = matrix[0];
  const findColIdx = (names: string[]) =>
    headerRow.findIndex((h) => names.some((n) => h.includes(n)));
  const colIdx = (names: string[], defaultIdx: number) => {
    const found = findColIdx(names);
    return found >= 0 ? found : defaultIdx;
  };

  const idxCode = colIdx(['项目编号', '编号'], 0);
  const idxName = colIdx(['项目名称', '名称'], 1);
  const idxClient = colIdx(['客户', '客户名称'], 2);
  const idxMilestone = colIdx(['收款节点', '节点'], 3);
  const idxGroup = colIdx(['业务组', '部门'], 4);
  const idxManager = colIdx(['负责人', '项目经理'], 5);
  const idxStage = colIdx(['阶段'], 6);
  const idxContract = colIdx(['合同额'], 7);
  const idxBudget = colIdx(['核定预算', '预算'], 8);
  const idxProgress = colIdx(['完工进度', '进度'], 9);
  const idxInvoiced = colIdx(['已开票', '开票'], 10);
  const idxCollected = colIdx(['已回款', '回款'], 11);
  const idxOverdue = colIdx(['逾期天数', '账龄'], 12);
  const idxLabor = findColIdx(['人工工时']);
  const idxProc = findColIdx(['软硬件采购']);
  const idxOut = findColIdx(['外包技术']);
  const idxTravel = findColIdx(['差旅实施']);

  const nextProjects = existingProjects.map((p) => ({
    ...p,
    vouchers: [...p.vouchers],
    paymentRecords: [...(p.paymentRecords ?? [])],
  }));

  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const skippedReasons: string[] = [];
  const today = new Date().toISOString().slice(0, 10);

  const cellAt = (row: string[], idx: number): string | undefined =>
    idx >= 0 ? row[idx] : undefined;

  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r];
    const code = (cellAt(row, idxCode) || '').trim();
    const name = (cellAt(row, idxName) || '').trim();
    if (!code || !name) {
      skippedCount++;
      if (skippedReasons.length < 3) {
        skippedReasons.push(`第 ${r + 1} 行缺少项目编号或名称`);
      }
      continue;
    }

    const contractAmount = parseNumber(cellAt(row, idxContract), NaN);
    const approvedBudget = parseNumber(cellAt(row, idxBudget), NaN);
    if (
      !Number.isFinite(contractAmount) ||
      contractAmount < 0 ||
      !Number.isFinite(approvedBudget) ||
      approvedBudget < 1
    ) {
      skippedCount++;
      if (skippedReasons.length < 3) {
        skippedReasons.push(`第 ${r + 1} 行 (${code}) 合同额或核定预算无效`);
      }
      continue;
    }

    const laborRaw = cellAt(row, idxLabor);
    const procRaw = cellAt(row, idxProc);
    const outRaw = cellAt(row, idxOut);
    const travelRaw = cellAt(row, idxTravel);

    const labor = Math.max(0, parseNumber(laborRaw, 0));
    const procurement = Math.max(0, parseNumber(procRaw, 0));
    const outsourcing = Math.max(0, parseNumber(outRaw, 0));
    const travel = Math.max(0, parseNumber(travelRaw, 0));

    const buildInitVouchers = (prefix: string): CostVoucher[] => {
      const list: CostVoucher[] = [];
      if (labor > 0) {
        list.push({
          id: `${prefix}-l-${Date.now()}-${r}`,
          date: today,
          voucherNo: `CSV-${r}-01`,
          category: '人工工时',
          source: 'HR',
          amountExclTax: labor,
          taxRate: 0,
          summary: 'CSV批量导入初始人工工时归集',
        });
      }
      if (procurement > 0) {
        list.push({
          id: `${prefix}-p-${Date.now()}-${r}`,
          date: today,
          voucherNo: `CSV-${r}-02`,
          category: '软硬件采购',
          source: 'ERP',
          amountExclTax: procurement,
          taxRate: 13,
          summary: 'CSV批量导入初始软硬件采购成本',
        });
      }
      if (outsourcing > 0) {
        list.push({
          id: `${prefix}-o-${Date.now()}-${r}`,
          date: today,
          voucherNo: `CSV-${r}-03`,
          category: '外包技术',
          source: 'OA',
          amountExclTax: outsourcing,
          taxRate: 6,
          summary: 'CSV批量导入初始外包技术服务费',
        });
      }
      if (travel > 0) {
        list.push({
          id: `${prefix}-t-${Date.now()}-${r}`,
          date: today,
          voucherNo: `CSV-${r}-04`,
          category: '差旅实施',
          source: 'OA',
          amountExclTax: travel,
          taxRate: 6,
          summary: 'CSV批量导入初始差旅及现场实施费',
        });
      }
      return list;
    };

    const existingIndex = nextProjects.findIndex(
      (p) => p.code.trim().toLowerCase() === code.toLowerCase()
    );
    // Only overwrite existing vouchers if category columns were present AND non-empty
    const hasNonEmptyCategoryValues = [
      laborRaw,
      procRaw,
      outRaw,
      travelRaw,
    ].some((cell) => (cell ?? '').trim() !== '');

    if (existingIndex >= 0) {
      const prev = nextProjects[existingIndex];
      const nextInvoiced = Math.max(
        0,
        parseNumber(cellAt(row, idxInvoiced), prev.invoicedAmount)
      );
      const nextCollected = Math.max(
        0,
        parseNumber(cellAt(row, idxCollected), prev.collectedAmount)
      );
      const nextMilestone = cellAt(row, idxMilestone) || prev.milestone;
      const billingChanged =
        nextInvoiced !== prev.invoicedAmount ||
        nextCollected !== prev.collectedAmount;
      nextProjects[existingIndex] = {
        ...prev,
        name,
        client: cellAt(row, idxClient) || prev.client,
        milestone: nextMilestone,
        businessGroup: cellAt(row, idxGroup) || prev.businessGroup,
        manager: cellAt(row, idxManager) || prev.manager,
        stage: cellAt(row, idxStage)
          ? normalizeStage(cellAt(row, idxStage))
          : prev.stage,
        contractAmount,
        approvedBudget,
        progress: Math.min(
          100,
          Math.max(0, parseNumber(cellAt(row, idxProgress), prev.progress))
        ),
        invoicedAmount: nextInvoiced,
        collectedAmount: nextCollected,
        maxOverdueDays: Math.max(
          0,
          Math.round(parseNumber(cellAt(row, idxOverdue), prev.maxOverdueDays))
        ),
        vouchers: hasNonEmptyCategoryValues
          ? buildInitVouchers(prev.id)
          : prev.vouchers,
        paymentRecords: billingChanged
          ? buildInitialPaymentRecords(
              prev.id,
              nextInvoiced,
              nextCollected,
              nextMilestone,
              today
            )
          : prev.paymentRecords,
      };
      updatedCount++;
    } else {
      const newId = `prj-${Date.now()}-${r}`;
      const invoiced = Math.max(0, parseNumber(cellAt(row, idxInvoiced), 0));
      const collected = Math.max(0, parseNumber(cellAt(row, idxCollected), 0));
      const milestone = cellAt(row, idxMilestone) || '进度验收款';
      nextProjects.push({
        id: newId,
        code,
        name,
        client: cellAt(row, idxClient) || '企业客户',
        milestone,
        businessGroup: cellAt(row, idxGroup) || '数智底座组',
        manager: cellAt(row, idxManager) || '待指派',
        stage: normalizeStage(cellAt(row, idxStage)),
        contractAmount,
        approvedBudget,
        progress: Math.min(
          100,
          Math.max(0, parseNumber(cellAt(row, idxProgress), 0))
        ),
        invoicedAmount: invoiced,
        collectedAmount: collected,
        maxOverdueDays: Math.max(
          0,
          Math.round(parseNumber(cellAt(row, idxOverdue), 0))
        ),
        vouchers: buildInitVouchers(newId),
        paymentRecords: buildInitialPaymentRecords(
          newId,
          invoiced,
          collected,
          milestone,
          today
        ),
      });
      addedCount++;
    }
  }

  return {
    projects: nextProjects,
    addedCount,
    updatedCount,
    skippedCount,
    skippedReasons,
  };
}
