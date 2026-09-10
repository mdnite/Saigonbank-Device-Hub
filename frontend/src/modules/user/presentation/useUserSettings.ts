import { useCallback, useState } from 'react';
import {
  emptyUserSettings,
  validateUserSettings,
  type UserSettings,
  type UserSettingsErrors,
} from '../domain/userSettings';

/**
 * Local editable copy of the settings form.
 * - `load` reseeds both the draft and the baseline (initial fetch, or after a successful save).
 * - `revert` drops unsaved edits back to that baseline (the Hủy button).
 * - `dirty` is a cheap reference check — `patch` always makes a new object.
 */
export function useUserSettings() {
  const [draft, setDraft] = useState<UserSettings>(emptyUserSettings);
  const [baseline, setBaseline] = useState<UserSettings>(draft);
  const [errors, setErrors] = useState<UserSettingsErrors>({});

  const patch = useCallback((p: Partial<UserSettings>) => {
    setDraft((d) => ({ ...d, ...p }));
  }, []);

  const load = useCallback((next: UserSettings) => {
    setDraft(next);
    setBaseline(next);
    setErrors({});
  }, []);

  const revert = useCallback(() => {
    setDraft(baseline);
    setErrors({});
  }, [baseline]);

  const validate = useCallback(() => {
    const next = validateUserSettings(draft);
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [draft]);

  return { draft, errors, dirty: draft !== baseline, patch, load, revert, validate };
}
