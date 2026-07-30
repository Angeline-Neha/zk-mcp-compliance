import { useState, useEffect } from "react";
import { fetchInspectorDetail } from "./api";
import type { InspectorSnapshot } from "./inspectorTypes";

export function useInspector(requestId: string | null) {
  const [data, setData] = useState<InspectorSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!requestId) {
      setData(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchInspectorDetail(requestId)
      .then((snap) => {
        if (!cancelled) setData(snap);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [requestId]);

  return { data, loading, error };
}
