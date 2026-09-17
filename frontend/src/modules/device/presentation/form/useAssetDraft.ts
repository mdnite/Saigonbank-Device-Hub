import { useCallback, useState } from 'react';
import {
  emptyAssetDraft,
  validateAssetDraft,
  type AssetDraft,
  type AssetDraftErrors,
} from '../../domain/assetDraft';

export function useAssetDraft(initial: AssetDraft = emptyAssetDraft()) {
  const [draft, setDraft] = useState<AssetDraft>(initial);
  const [errors, setErrors] = useState<AssetDraftErrors>({});

  const patch = useCallback((p: Partial<AssetDraft>) => {
    setDraft((d) => ({ ...d, ...p }));
  }, []);

  const validate = useCallback(() => {
    const next = validateAssetDraft(draft);
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [draft]);

  return { draft, errors, patch, validate };
}
