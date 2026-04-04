import useSWR from 'swr';
import { DrugBundle } from '../types/pharma';

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:8000';

export const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}: ${res.statusText}`);
    throw err;
  }
  return res.json();
};

export function useDrug(name: string | null) {
  const { data, error, isLoading } = useSWR<DrugBundle>(
    name ? `/api/drug/${encodeURIComponent(name)}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  );

  return {
    drug: data,
    isLoading,
    isError: !!error,
    error,
  };
}

export function useAutocomplete(prefix: string) {
  const { data, error } = useSWR<string[]>(
    prefix && prefix.length >= 2
      ? `/api/search/autocomplete?prefix=${encodeURIComponent(prefix)}`
      : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  return {
    suggestions: data || [],
    isLoading: !error && !data && prefix.length >= 2,
    isError: !!error,
  };
}
