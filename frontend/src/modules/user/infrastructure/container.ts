import { makeUserSettingsService } from '../application/UserSettingsRepository';
import { InMemoryUserSettingsRepository } from './InMemoryUserSettingsRepository';

export const userSettingsService = makeUserSettingsService(new InMemoryUserSettingsRepository());
