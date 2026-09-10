import { emptyUserSettings, type UserSettings } from '../domain/userSettings';
import type { UserSettingsRepository } from '../application/UserSettingsRepository';

/** ponytail: single seeded record, mutated in place. Swap for an HTTP adapter when a backend exists. */
export class InMemoryUserSettingsRepository implements UserSettingsRepository {
  private settings: UserSettings = {
    ...emptyUserSettings(),
    fullName: 'Hàn Nguyễn',
    department: 'Khối Công nghệ thông tin',
    title: 'Chuyên viên',
    email: 'han.nguyen@saigonbank.com.vn',
    employeeCode: 'SGB-IT-0142',
    phone: '0903 123 456',
  };

  async get(): Promise<UserSettings> {
    await new Promise((r) => setTimeout(r, 250));
    return { ...this.settings };
  }

  async save(settings: UserSettings): Promise<UserSettings> {
    await new Promise((r) => setTimeout(r, 300));
    this.settings = { ...settings };
    return { ...this.settings };
  }
}
