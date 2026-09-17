export type StatTone = 'blue' | 'green' | 'purple' | 'orange';

export interface DashboardStat {
  key: string;
  label: string;
  value: number;
  hint?: string;
  tone: StatTone;
}
