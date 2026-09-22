import { useCallback, useState } from 'react';
import {
  emptyDeviceDraft,
  validateDeviceDraft,
  type DeviceDraft,
  type DeviceDraftErrors,
} from '../../domain/deviceDraft';

export function useDeviceDraft(initial?: DeviceDraft) {
  const [draft, setDraft] = useState<DeviceDraft>(initial ?? emptyDeviceDraft());
  const [errors, setErrors] = useState<DeviceDraftErrors>({});

  const patch = useCallback((p: Partial<DeviceDraft>) => {
    setDraft((d) => ({ ...d, ...p }));
  }, []);

  const validate = useCallback(() => {
    const next = validateDeviceDraft(draft);
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [draft]);

  return { draft, errors, patch, validate };
}
