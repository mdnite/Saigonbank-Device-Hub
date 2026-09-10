import {
  hasErrors,
  validateUserSettings,
  type UserSettings,
} from '../domain/userSettings';

export interface UserSettingsRepository {
  get(): Promise<UserSettings>;
  save(settings: UserSettings): Promise<UserSettings>;
}

export class UserSettingsValidationError extends Error {
  constructor(public readonly fields: Record<string, string>) {
    super('Biểu mẫu chưa hợp lệ');
    this.name = 'UserSettingsValidationError';
  }
}

export function makeUserSettingsService(repo: UserSettingsRepository) {
  return {
    get: () => repo.get(),
    save: (settings: UserSettings) => {
      const errors = validateUserSettings(settings);
      if (hasErrors(errors)) throw new UserSettingsValidationError(errors as Record<string, string>);
      return repo.save(settings);
    },
  };
}

export type UserSettingsService = ReturnType<typeof makeUserSettingsService>;
