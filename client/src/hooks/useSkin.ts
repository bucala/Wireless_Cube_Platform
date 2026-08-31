import { useCallback, useState } from 'react';

import { applySkin, loadStoredSkin, skinById, storeSkin, type SkinId } from '../lib/skins';

/**
 * Aktívny skin. Paletu na <html> zapisuje už main.tsx pred prvým renderom,
 * takže tu nie je potrebný efekt a nedochádza k bliknutiu pri načítaní.
 */
export function useSkin() {
  const [skinId, setSkinId] = useState<SkinId>(() => loadStoredSkin());

  const setSkin = useCallback((id: SkinId) => {
    applySkin(id);
    storeSkin(id);
    setSkinId(id);
  }, []);

  return { skinId, skin: skinById(skinId), setSkin };
}

export type SkinState = ReturnType<typeof useSkin>;
