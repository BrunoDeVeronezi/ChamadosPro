export type ServiceItemInput = {
  name?: string | null;
  amount?: number | string | null;
};

export type ServiceItem = {
  name: string;
  amount: number;
};

export const coerceServiceItems = (
  items?: ServiceItemInput[] | null
): ServiceItem[] => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      const name = (item?.name ?? '').toString().trim();
      const rawAmount = item?.amount ?? 0;
      const amount =
        typeof rawAmount === 'string' ? Number(rawAmount) : Number(rawAmount);
      return { name, amount: Number.isFinite(amount) ? amount : 0 };
    })
    .filter((item) => item.name || item.amount > 0);
};

export const buildServiceSummary = (
  items?: ServiceItemInput[] | null,
  fallback = 'Servico Prestado'
) => {
  const normalized = coerceServiceItems(items);
  if (normalized.length === 0) return fallback;

  const names = normalized.map((item) => item.name).filter(Boolean);
  if (names.length === 0) return fallback;
  if (names.length <= 2) return names.join(' + ');

  return `${names[0]} + ${names.length - 1} servicos`;
};
