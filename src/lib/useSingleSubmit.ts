import { useCallback, useRef, useState } from "react";

/**
 * Evita envio duplicado (duplo clique, Enter repetido, etc.).
 * O lock em ref bloqueia na mesma tick antes do re-render do useState.
 */
export function useSingleSubmit() {
  const lockRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const guard = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (lockRef.current) return undefined;
    lockRef.current = true;
    setIsSubmitting(true);
    try {
      return await fn();
    } finally {
      lockRef.current = false;
      setIsSubmitting(false);
    }
  }, []);

  return { isSubmitting, guard };
}
