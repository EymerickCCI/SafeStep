import Dexie, { type Table } from 'dexie';

export interface EPI {
  id: number;
  tag_ref: string;
  category: 'casque' | 'harnais' | 'detecteur_gaz' | 'gants' | 'gilet' | 'autre';
  status: 'conforme' | 'a_inspecter' | 'endommage' | 'en_maintenance';
  user_id?: number;
  site_id: number;
  quantity: number;
  available: number;
  last_check: string;
  updated_at?: string;
  is_local_only?: boolean;
}

export interface SyncItem {
  id?: number;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'put' | 'delete';
  entity: 'epi';
  data: any;
  timestamp: number;
}

export class SafeStepDB extends Dexie {
  epi!: Table<EPI>;
  syncQueue!: Table<SyncItem>;

  constructor() {
    super('SafeStepDB');
    this.version(2).stores({
      epi: 'id, tag_ref, category, status, site_id',
      syncQueue: '++id, timestamp'
    });
  }
}

export const db = new SafeStepDB();
