export interface Staff {
  id: string;
  name: string;
  role?: string;
  attributes?: Record<string, string | number | boolean | null>;
}

export interface ScheduleEntry {
  id: string;
  staffId: string;
  date: string;
  startTime?: string;
  endTime?: string;
  task?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface CommonModel {
  staff: Staff[];
  scheduleEntries: ScheduleEntry[];
}

export interface RuleResult {
  ruleId: string;
  passed: boolean;
  severity?: 'info' | 'warning' | 'error';
  message: string;
  relatedEntryIds?: string[];
}

export interface InputMapping {
  sourceField: string;
  targetField: keyof Staff | keyof ScheduleEntry;
  transform?: string;
  required?: boolean;
}

export interface OutputMapping {
  sourceField: keyof CommonModel | string;
  targetField: string;
  format?: 'string' | 'number' | 'boolean' | 'date' | 'datetime';
}
