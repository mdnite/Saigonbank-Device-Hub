import { makeUserAdminService } from '../application/UserAdminRepository';
import { makeUserSettingsService } from '../application/UserSettingsRepository';
import { HttpUserAdminRepository } from './HttpUserAdminRepository';
import { InMemoryUserSettingsRepository } from './InMemoryUserSettingsRepository';

export const userSettingsService = makeUserSettingsService(new InMemoryUserSettingsRepository());
export const userAdminService = makeUserAdminService(new HttpUserAdminRepository());
