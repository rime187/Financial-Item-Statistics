export type CostCategory = '人工工时' | '软硬件采购' | '外包技术' | '差旅实施';

export type VoucherSource = 'ERP' | 'OA' | 'HR' | '手工';

export type ProjectStage = '立项中' | '实施中' | '试运行' | '已验收';

export type HealthStatus = '正常' | '超支' | '回款滞后';

export type TabId = 'cockpit' | 'ledger' | 'receivables' | 'eac';

export interface CostVoucher {
  id: string;
  date: string;
  voucherNo: string;
  category: CostCategory;
  source: VoucherSource;
  /** 不含税金额（单位：万元） */
  amountExclTax: number;
  /** 税率（百分比，如 0, 6, 13） */
  taxRate: number;
  summary: string;
}

export type PaymentRecordType = '开票' | '回款';

export interface PaymentRecord {
  id: string;
  date: string;
  type: PaymentRecordType;
  /** 金额（单位：万元） */
  amount: number;
  voucherNo: string;
  note: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  client: string;
  milestone: string;
  businessGroup: string;
  manager: string;
  stage: ProjectStage;
  /** 合同额（万元） */
  contractAmount: number;
  /** 核定总预算（万元） */
  approvedBudget: number;
  /** 完工进度 0~100 */
  progress: number;
  /** 累计已开票（万元，由 paymentRecords 实时汇总） */
  invoicedAmount: number;
  /** 累计已回款（万元，由 paymentRecords 实时汇总） */
  collectedAmount: number;
  /** 最长逾期账龄（天） */
  maxOverdueDays: number;
  vouchers: CostVoucher[];
  paymentRecords: PaymentRecord[];
}

export interface CategoryCosts {
  labor: number;       // 人工工时
  procurement: number; // 软硬件采购
  outsourcing: number; // 外包技术
  travel: number;      // 差旅实施
}

export interface ProjectMetrics {
  categoryCosts: CategoryCosts;
  actualCost: number;
  budgetConsumptionRate: number;
  recognizedRevenue: number;
  grossProfit: number;
  grossMargin: number;
  uncollectedReceivable: number;
  collectionRate: number;
  invoicedRate: number;
  healthStatus: HealthStatus;
  isOverBudget: boolean;
  isOverrunWarning: boolean;
  isCollectionLag: boolean;
  diagnosticNotes: string[];
}

export interface EnrichedProject extends Project {
  metrics: ProjectMetrics;
}

export interface FilterState {
  businessGroup: string;
  stage: string;
  healthStatus: string;
}

export const COST_CATEGORIES: CostCategory[] = [
  '人工工时',
  '软硬件采购',
  '外包技术',
  '差旅实施',
];

export const CATEGORY_COLORS: Record<CostCategory, string> = {
  '人工工时': '#3B82F6',
  '软硬件采购': '#6366F1',
  '外包技术': '#F59E0B',
  '差旅实施': '#10B981',
};

export const PROJECT_STAGES: ProjectStage[] = ['立项中', '实施中', '试运行', '已验收'];

export const VOUCHER_SOURCES: VoucherSource[] = ['ERP', 'OA', 'HR', '手工'];
