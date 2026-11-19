export type Role = 'admin' | 'finance' | 'hr' | 'technique' | 'commercial' | 'secretariat';

export interface User {
  id: number;
  username: string;
  role: Role;
  name: string;
  mustChangePassword?: boolean;
}

/** Every record carries its id and version (used to detect concurrent edits). */
export type Rec<T> = T & { id: string; _v: number; _updatedAt?: string; _updatedBy?: string };

export interface ManualPayment { id: string; amount: number; date: string; note?: string }

export interface Client {
  name: string; legalName: string; address: string; nif: string; nis: string; rc: string; ai: string; tin: string;
  contactPerson: string; phone: string; phone2: string; email: string; paymentTerms: string; rib: string;
  activity: string; notes: string;
}
export interface Supplier extends Omit<Client, 'ai' | 'tin'> { alertLimit: number }

export type Journal = 'caisse' | 'banque';
export interface Allocation { type: 'situation' | 'supplierInvoice'; id: string; amount: number }
export interface Transaction {
  journal: Journal;
  type: 'in' | 'out';
  amount: number;
  description: string;
  date: string;
  projectId: string | null;
  clientId: string | null;
  supplierId: string | null;
  chequeNo: string;
  invoiceStatus: 'ok' | 'missing';
  allocations: Allocation[];
}

export interface Situation {
  clientId: string | null;
  project: string;
  number: string;
  date: string;
  amount: number;
  contractType: 'formel' | 'informel';
  invoiceId: string | null;
  manualPayments: ManualPayment[];
}

export interface SupplierInvoice {
  supplierId: string | null;
  supplierName?: string | null;
  reference: string;
  date: string;
  amount: number;
  manualPayments: ManualPayment[];
}

export interface Charge { label: string; category: string; amount: number }

export interface Project {
  name: string;
  clientId: string | null;
  contractValue: number;
  startDate: string;
  status: 'active' | 'done';
  manualExpenses: { id: string; description: string; amount: number; date: string }[];
  manualPayments: { id: string; reference: string; amount: number; date: string }[];
}

export interface PettyCashMove {
  type: 'in' | 'out';
  amount: number;
  date: string;
  description: string;
  beneficiary: string;
  supplierId: string | null;
}

export interface SimulatorState { picks: Record<string, number>; amounts: Record<string, number> }

export interface CompanySettings {
  name: string; activity: string; address: string; rc: string; nif: string; nis: string; ai: string;
  phone: string; email: string; city: string;
}

export interface Collections {
  clients: Client;
  suppliers: Supplier;
  transactions: Transaction;
  situations: Situation;
  supplierInvoices: SupplierInvoice;
  charges: Charge;
  projects: Project;
  pettyCash: PettyCashMove;
  simulator: SimulatorState;
  settings: CompanySettings;
  invoices: Record<string, unknown>;
  ribs: { bank: string; number: string };
  workers: Record<string, unknown>;
  workSites: Record<string, unknown>;
  attendance: Record<string, unknown>;
  attendanceLegend: Record<string, unknown>;
  hrDocuments: Record<string, unknown>;
  hrFolders: Record<string, unknown>;
  pendingScans: Record<string, unknown>;
  techSitesLegacy: Record<string, unknown>;
}
export type CollectionName = keyof Collections;
