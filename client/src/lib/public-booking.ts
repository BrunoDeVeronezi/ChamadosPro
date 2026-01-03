export interface AvailableSlot {
  date: string;
  time: string;
  datetime: string;
}

interface FetchAvailableSlotsParams {
  userSlug: string;
  serviceId: string;
  startDate: Date;
  endDate: Date;
}

export async function fetchPublicAvailableSlots({
  userSlug,
  serviceId,
  startDate,
  endDate,
}: FetchAvailableSlotsParams): Promise<AvailableSlot[]> {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const params = new URLSearchParams({
    userSlug,
    serviceId,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  });

  const response = await fetch(
    `/api/public/booking/available-slots?${params.toString()}`
  );

  if (!response.ok) {
    const text = (await response.text()) || response.statusText;
    throw new Error(text);
  }

  const data = await response.json();
  return (data.slots ?? []) as AvailableSlot[];
}
