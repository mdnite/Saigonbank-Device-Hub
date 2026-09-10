import type { AssetDraft } from '../domain/assetDraft';
import type { Device } from '../domain/device';
import type { DeviceQuery, DeviceRepository } from '../application/DeviceRepository';

const SPEC = { cpu: 'Intel Core i5-1135G7', ram: '16GB RAM', storage: '512GB SSD' };

const SEED: Device[] = [
  { id: 'LT-DELL-001', name: 'Dell Latitude 5420', spec: SPEC, owner: 'Nguyễn Văn A - IT', status: 'IN_STOCK' },
  { id: 'LT-DELL-002', name: 'Dell Latitude 5420', spec: SPEC, owner: 'Nguyễn Văn A - IT', status: 'ALLOCATED' },
  { id: 'LT-DELL-003', name: 'Dell Latitude 5420', spec: SPEC, owner: null, status: 'ALLOCATED' },
  { id: 'LT-DELL-004', name: 'Dell Latitude 5420', spec: SPEC, owner: 'Nguyễn Văn A - IT', status: 'ALLOCATED' },
  { id: 'LT-DELL-005', name: 'Dell Latitude 5420', spec: SPEC, owner: 'Nguyễn Văn A - IT', status: 'ALLOCATED' },
  { id: 'LT-DELL-006', name: 'Dell Latitude 5420', spec: SPEC, owner: 'Nguyễn Văn A - IT', status: 'PENDING_DISPOSAL' },
  { id: 'LT-DELL-007', name: 'Dell Latitude 5420', spec: SPEC, owner: null, status: 'PENDING_DISPOSAL' },
  { id: 'LT-DELL-008', name: 'Dell Latitude 5420', spec: SPEC, owner: 'Nguyễn Văn A - IT', status: 'PENDING_DISPOSAL' },
];

const delay = () => new Promise((r) => setTimeout(r, 300));

export class InMemoryDeviceRepository implements DeviceRepository {
  private devices: Device[] = [...SEED];

  async list(query: DeviceQuery = {}): Promise<Device[]> {
    await delay();
    const search = query.search?.trim().toLowerCase();
    return this.devices.filter((d) => {
      if (query.status && query.status !== 'ALL' && d.status !== query.status) return false;
      if (search && !`${d.id} ${d.name}`.toLowerCase().includes(search)) return false;
      return true;
    });
  }

  async getById(id: string): Promise<Device | null> {
    await delay();
    return this.devices.find((d) => d.id === id) ?? null;
  }

  async create(draft: AssetDraft): Promise<Device> {
    await delay();
    const device: Device = {
      id: draft.deviceCode.trim(),
      name: draft.deviceName.trim(),
      spec: { cpu: draft.specDetail.trim(), ram: '', storage: '' },
      owner: draft.allocated ? draft.employee.trim() || null : null,
      status: draft.allocated ? 'ALLOCATED' : 'IN_STOCK',
    };
    this.devices = [device, ...this.devices];
    return device;
  }
}
