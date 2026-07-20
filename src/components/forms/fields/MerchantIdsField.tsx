import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchMerchants } from './MerchantIdField';
import { TagComboField } from './TagComboField';

interface Props {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  required?: boolean;
  error?: string;
  help?: string;
}

/** Up-to-`max` merchant id picker, backed by the internal merchant directory. */
export default function MerchantIdsField({ label, value, onChange, max, required, error, help }: Props) {
  const { data: merchants = [], isLoading } = useQuery({
    queryKey: ['merchants', 'any-logo'],
    queryFn: fetchMerchants,
    staleTime: 5 * 60 * 1000,
  });

  const suggestions = useMemo(
    () => merchants.map((m) => ({ value: m.merchantId, label: `${m.name} (${m.merchantId})` })),
    [merchants],
  );

  return (
    <TagComboField
      label={label}
      value={value}
      onChange={onChange}
      suggestions={suggestions}
      isLoading={isLoading}
      max={max}
      required={required}
      error={error}
      help={help}
      placeholder="ID de comercio, o busca por nombre…"
    />
  );
}
