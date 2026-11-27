import {
  CategoryCosts,
  EnrichedProject,
  HealthStatus,
  Project,
  ProjectMetrics,
} from '../types';

export function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

export function round1(val: number): number {
  return Math.round((val + Number.EPSILON) * 10) / 10;
}

export function formatWan(val: number, decimals = 1): string {
  const abs = Math.abs(val);
  const formatted = abs.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${val < 0 ? '-' : ''}¥${formatted}万`;
}

export function formatWanPlain(val: number, decimals = 1): string {
  return val.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatYuan(wanVal: number): string {
  const yuan = wanVal * 10000;
  return `¥${yuan.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPercent(val: number, decimals = 1): string {
  return `${val.toFixed(decimals)}%`;
}

export function calcProjectMetrics(project: Project): ProjectMetrics {
  const categoryCosts: CategoryCosts = {
    labor: 0,
    procurement: 0,
    outsourcing: 0,
    travel: 0,
  };

  for (const v of project.vouchers) {
    if (v.category === '人工工时') categoryCosts.labor += v.amountExclTax;
    else if (v.category === '软硬件采购') categoryCosts.procurement += v.amountExclTax;
    else if (v.category === '外包技术') categoryCosts.outsourcing += v.amountExclTax;
    else if (v.category === '差旅实施') categoryCosts.travel += v.amountExclTax;
  }

  categoryCosts.labor = round2(categoryCosts.labor);
  categoryCosts.procurement = round2(categoryCosts.procurement);
  categoryCosts.outsourcing = round2(categoryCosts.outsourcing);
  categoryCosts.travel = round2(categoryCosts.travel);

  const actualCost = round2(
    categoryCosts.labor +
      categoryCosts.procurement +
      categoryCosts.outsourcing +
      categoryCosts.travel
  );

  const budgetConsumptionRate =
    project.approvedBudget > 0
      ? (actualCost / project.approvedBudget) * 100
      : 0;

  const recognizedRevenue = round2(
    project.contractAmount * (project.progress / 100)
  );

  const grossProfit = round2(recognizedRevenue - actualCost);

  const grossMargin =
    recognizedRevenue > 0 ? (grossProfit / recognizedRevenue) * 100 : 0;

  const uncollectedReceivable = round2(
    Math.max(0, project.invoicedAmount - project.collectedAmount)
  );

  const collectionRate =
    project.contractAmount > 0
      ? (project.collectedAmount / project.contractAmount) * 100
      : 0;

  const invoicedRate =
    project.contractAmount > 0
      ? (project.invoicedAmount / project.contractAmount) * 100
      : 0;

  const isOverBudget = budgetConsumptionRate > 100;
  const isPaceDeviation = budgetConsumptionRate - project.progress > 10;
  const isOverrunWarning = isOverBudget || isPaceDeviation;
  const isCollectionLag =
    !isOverrunWarning &&
    project.maxOverdueDays > 60 &&
    uncollectedReceivable > 0;

  let healthStatus: HealthStatus = '正常';
  if (isOverrunWarning) {
    healthStatus = '超支';
  } else if (isCollectionLag) {
    healthStatus = '回款滞后';
  }

  const diagnosticNotes: string[] = [];
  if (isOverBudget) {
    const overAmount = round1(actualCost - project.approvedBudget);
    diagnosticNotes.push(
      `实际成本 ¥${actualCost.toFixed(1)}万 已超核定预算 ¥${project.approvedBudget.toFixed(1)}万 (+¥${overAmount.toFixed(1)}万)`
    );
  }
  if (isPaceDeviation) {
    diagnosticNotes.push(
      `消耗率(${budgetConsumptionRate.toFixed(1)}%)超完工进度(${project.progress}%)`
    );
  }
  if (project.maxOverdueDays > 60 && uncollectedReceivable > 0) {
    diagnosticNotes.push(
      `开票未回 ¥${uncollectedReceivable.toFixed(1)}万 账龄 ${project.maxOverdueDays} 天`
    );
  }
  if (recognizedRevenue > 0 && grossMargin < 32) {
    diagnosticNotes.push(`当前核算毛利率偏低 (${grossMargin.toFixed(1)}%)`);
  }

  return {
    categoryCosts,
    actualCost,
    budgetConsumptionRate,
    recognizedRevenue,
    grossProfit,
    grossMargin,
    uncollectedReceivable,
    collectionRate,
    invoicedRate,
    healthStatus,
    isOverBudget,
    isOverrunWarning,
    isCollectionLag,
    diagnosticNotes,
  };
}

export function enrichProjects(projects: Project[]): EnrichedProject[] {
  return projects.map((p) => ({
    ...p,
    metrics: calcProjectMetrics(p),
  }));
}

export interface PortfolioSummary {
  projectCount: number;
  totalContract: number;
  totalBudget: number;
  totalActualCost: number;
  totalRecognizedRevenue: number;
  totalGrossProfit: number;
  overallGrossMargin: number;
  overallBudgetConsumptionRate: number;
  totalInvoiced: number;
  totalCollected: number;
  totalUncollected: number;
  overallInvoicedRate: number;
  overallCollectionRate: number;
  invoicedCollectionRate: number;
  overrunCount: number;
  lagCount: number;
  alertCount: number;
  overdue60PlusAmount: number;
  categoryTotals: CategoryCosts;
}

export function calcPortfolioSummary(
  projects: EnrichedProject[]
): PortfolioSummary {
  let totalContract = 0;
  let totalBudget = 0;
  let totalActualCost = 0;
  let totalRecognizedRevenue = 0;
  let totalInvoiced = 0;
  let totalCollected = 0;
  let totalUncollected = 0;
  let overrunCount = 0;
  let lagCount = 0;
  let alertCount = 0;
  let overdue60PlusAmount = 0;

  const categoryTotals: CategoryCosts = {
    labor: 0,
    procurement: 0,
    outsourcing: 0,
    travel: 0,
  };

  for (const p of projects) {
    totalContract += p.contractAmount;
    totalBudget += p.approvedBudget;
    totalActualCost += p.metrics.actualCost;
    totalRecognizedRevenue += p.metrics.recognizedRevenue;
    totalInvoiced += p.invoicedAmount;
    totalCollected += p.collectedAmount;
    totalUncollected += p.metrics.uncollectedReceivable;

    categoryTotals.labor += p.metrics.categoryCosts.labor;
    categoryTotals.procurement += p.metrics.categoryCosts.procurement;
    categoryTotals.outsourcing += p.metrics.categoryCosts.outsourcing;
    categoryTotals.travel += p.metrics.categoryCosts.travel;

    if (p.metrics.healthStatus === '超支') overrunCount += 1;
    if (p.metrics.healthStatus === '回款滞后') lagCount += 1;
    if (
      p.metrics.healthStatus !== '正常' ||
      (p.maxOverdueDays > 60 && p.metrics.uncollectedReceivable > 0)
    ) {
      alertCount += 1;
    }
    if (p.maxOverdueDays > 60 && p.metrics.uncollectedReceivable > 0) {
      overdue60PlusAmount += p.metrics.uncollectedReceivable;
    }
  }

  const totalGrossProfit = round2(totalRecognizedRevenue - totalActualCost);
  const overallGrossMargin =
    totalRecognizedRevenue > 0
      ? (totalGrossProfit / totalRecognizedRevenue) * 100
      : 0;
  const overallBudgetConsumptionRate =
    totalBudget > 0 ? (totalActualCost / totalBudget) * 100 : 0;
  const overallInvoicedRate =
    totalContract > 0 ? (totalInvoiced / totalContract) * 100 : 0;
  const overallCollectionRate =
    totalContract > 0 ? (totalCollected / totalContract) * 100 : 0;
  const invoicedCollectionRate =
    totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0;

  return {
    projectCount: projects.length,
    totalContract: round2(totalContract),
    totalBudget: round2(totalBudget),
    totalActualCost: round2(totalActualCost),
    totalRecognizedRevenue: round2(totalRecognizedRevenue),
    totalGrossProfit,
    overallGrossMargin,
    overallBudgetConsumptionRate,
    totalInvoiced: round2(totalInvoiced),
    totalCollected: round2(totalCollected),
    totalUncollected: round2(totalUncollected),
    overallInvoicedRate,
    overallCollectionRate,
    invoicedCollectionRate,
    overrunCount,
    lagCount,
    alertCount,
    overdue60PlusAmount: round2(overdue60PlusAmount),
    categoryTotals: {
      labor: round2(categoryTotals.labor),
      procurement: round2(categoryTotals.procurement),
      outsourcing: round2(categoryTotals.outsourcing),
      travel: round2(categoryTotals.travel),
    },
  };
}

export interface BusinessGroupRow {
  group: string;
  recognizedRevenue: number;
  actualCost: number;
  approvedBudget: number;
  grossMargin: number;
  contractAmount: number;
  collectedAmount: number;
  collectionRate: number;
  projectCount: number;
}

export function calcBusinessGroupMetrics(
  projects: EnrichedProject[]
): BusinessGroupRow[] {
  const map = new Map<
    string,
    {
      recognizedRevenue: number;
      actualCost: number;
      approvedBudget: number;
      contractAmount: number;
      collectedAmount: number;
      projectCount: number;
    }
  >();

  for (const p of projects) {
    const cur = map.get(p.businessGroup) ?? {
      recognizedRevenue: 0,
      actualCost: 0,
      approvedBudget: 0,
      contractAmount: 0,
      collectedAmount: 0,
      projectCount: 0,
    };
    cur.recognizedRevenue += p.metrics.recognizedRevenue;
    cur.actualCost += p.metrics.actualCost;
    cur.approvedBudget += p.approvedBudget;
    cur.contractAmount += p.contractAmount;
    cur.collectedAmount += p.collectedAmount;
    cur.projectCount += 1;
    map.set(p.businessGroup, cur);
  }

  return Array.from(map.entries()).map(([group, val]) => {
    const rev = round1(val.recognizedRevenue);
    const cost = round1(val.actualCost);
    const gp = rev - cost;
    const grossMargin = rev > 0 ? round1((gp / rev) * 100) : 0;
    const collectionRate =
      val.contractAmount > 0
        ? round1((val.collectedAmount / val.contractAmount) * 100)
        : 0;
    return {
      group,
      recognizedRevenue: rev,
      actualCost: cost,
      approvedBudget: round1(val.approvedBudget),
      grossMargin,
      contractAmount: round1(val.contractAmount),
      collectedAmount: round1(val.collectedAmount),
      collectionRate,
      projectCount: val.projectCount,
    };
  });
}

export interface AgingBucket {
  bucket: string;
  label: string;
  amount: number;
  percent: number;
  count: number;
  color: string;
  risk: 'normal' | 'warning' | 'danger' | 'critical';
}

export function calcAgingDistribution(
  projects: EnrichedProject[]
): AgingBucket[] {
  const buckets = [
    {
      bucket: '0-30天',
      label: '0 - 30 天 (账期内)',
      amount: 0,
      count: 0,
      color: '#10B981',
      risk: 'normal' as const,
    },
    {
      bucket: '31-60天',
      label: '31 - 60 天 (临期预警)',
      amount: 0,
      count: 0,
      color: '#F59E0B',
      risk: 'warning' as const,
    },
    {
      bucket: '61-90天',
      label: '61 - 90 天 (轻度逾期)',
      amount: 0,
      count: 0,
      color: '#EF4444',
      risk: 'danger' as const,
    },
    {
      bucket: '90天以上',
      label: '90 天以上 (高危逾期)',
      amount: 0,
      count: 0,
      color: '#B91C1C',
      risk: 'critical' as const,
    },
  ];

  let totalUncollected = 0;
  for (const p of projects) {
    const uncollected = p.metrics.uncollectedReceivable;
    if (uncollected <= 0) continue;
    totalUncollected += uncollected;
    if (p.maxOverdueDays <= 30) {
      buckets[0].amount += uncollected;
      buckets[0].count += 1;
    } else if (p.maxOverdueDays <= 60) {
      buckets[1].amount += uncollected;
      buckets[1].count += 1;
    } else if (p.maxOverdueDays <= 90) {
      buckets[2].amount += uncollected;
      buckets[2].count += 1;
    } else {
      buckets[3].amount += uncollected;
      buckets[3].count += 1;
    }
  }

  return buckets.map((b) => ({
    ...b,
    amount: round1(b.amount),
    percent:
      totalUncollected > 0 ? round1((b.amount / totalUncollected) * 100) : 0,
  }));
}
