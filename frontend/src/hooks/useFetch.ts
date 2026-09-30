import { useCallback, useEffect, useState } from "react";
import { api, errMsg } from "../services/api";
export function useFetch<T = any>(url: string | null) {
  const [data, setData] = useState<T | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(!!url);
  const load = useCallback(() => { if (!url) return; setLoading(true); setError("");
    api.get(url).then((r) => setData(r.data)).catch((e) => setError(errMsg(e))).finally(() => setLoading(false)); }, [url]);
  useEffect(load, [load]);
  return { data, error, loading, reload: load };
}
export function useMyPatientId() { const { data } = useFetch<{ id: string }[]>("/patients"); return data?.[0]?.id ?? null; }
