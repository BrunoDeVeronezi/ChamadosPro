export type WorkingDayConfig = {
  enabled?: boolean;
  start?: string;
  end?: string;
  breakEnabled?: boolean;
  breakStart?: string;
  breakEnd?: string;
};

export type WorkingHoursConfig = {
  days?: Record<string, WorkingDayConfig>;
};

export type WorkingDaySchedule = {
  enabled: boolean;
  startMinutes: number;
  endMinutes: number;
  breakStartMinutes?: number;
  breakEndMinutes?: number;
};

export const SLOT_INTERVAL_MINUTES = 30;
const DEFAULT_DAY_START_MINUTES = 8 * 60;
const DEFAULT_DAY_END_MINUTES = 18 * 60;
const DEFAULT_BREAK_START_MINUTES = 12 * 60;
const DEFAULT_BREAK_END_MINUTES = 13 * 60;
const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5, 6];

const toMinutes = (value: unknown): number | null => {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
};

const minutesToTime = (minutes: number) => {
  const safeMinutes = Math.max(0, Math.min(minutes, 23 * 60 + 59));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const roundToSlot = (minutes: number) =>
  Math.floor(minutes / SLOT_INTERVAL_MINUTES) * SLOT_INTERVAL_MINUTES;

const parseWorkingDays = (workingDaysRaw: unknown): number[] | null => {
  const sanitize = (value: unknown) =>
    (Array.isArray(value) ? value : [])
      .map((day) => Number(day))
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);

  if (Array.isArray(workingDaysRaw)) {
    const sanitized = sanitize(workingDaysRaw);
    return sanitized.length > 0 ? sanitized : [];
  }

  if (typeof workingDaysRaw === 'string') {
    try {
      const parsed = JSON.parse(workingDaysRaw);
      const sanitized = sanitize(parsed);
      return sanitized.length > 0 ? sanitized : [];
    } catch {
      const sanitized = sanitize(
        workingDaysRaw
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean)
      );
      return sanitized.length > 0 ? sanitized : [];
    }
  }

  return null;
};

const parseWorkingHours = (workingHoursRaw: unknown): unknown => {
  if (typeof workingHoursRaw !== 'string') return workingHoursRaw;
  try {
    return JSON.parse(workingHoursRaw);
  } catch {
    return workingHoursRaw;
  }
};

const normalizeDayConfig = (
  raw: WorkingDayConfig | undefined,
  fallbackEnabled: boolean
): WorkingDayConfig => {
  const enabled = raw?.enabled ?? fallbackEnabled;
  let startMinutes =
    roundToSlot(toMinutes(raw?.start) ?? DEFAULT_DAY_START_MINUTES);
  let endMinutes =
    roundToSlot(toMinutes(raw?.end) ?? DEFAULT_DAY_END_MINUTES);

  if (endMinutes <= startMinutes) {
    startMinutes = DEFAULT_DAY_START_MINUTES;
    endMinutes = DEFAULT_DAY_END_MINUTES;
  }

  let breakEnabled = raw?.breakEnabled ?? false;
  let breakStartMinutes =
    roundToSlot(toMinutes(raw?.breakStart) ?? DEFAULT_BREAK_START_MINUTES);
  let breakEndMinutes =
    roundToSlot(toMinutes(raw?.breakEnd) ?? DEFAULT_BREAK_END_MINUTES);

  if (!breakEnabled) {
    return {
      enabled,
      start: minutesToTime(startMinutes),
      end: minutesToTime(endMinutes),
      breakEnabled: false,
      breakStart: minutesToTime(DEFAULT_BREAK_START_MINUTES),
      breakEnd: minutesToTime(DEFAULT_BREAK_END_MINUTES),
    };
  }

  if (breakStartMinutes < startMinutes) {
    breakStartMinutes = startMinutes;
  }
  if (breakEndMinutes > endMinutes) {
    breakEndMinutes = endMinutes;
  }
  if (breakEndMinutes <= breakStartMinutes) {
    breakEnabled = false;
  }

  return {
    enabled,
    start: minutesToTime(startMinutes),
    end: minutesToTime(endMinutes),
    breakEnabled,
    breakStart: minutesToTime(breakStartMinutes),
    breakEnd: minutesToTime(breakEndMinutes),
  };
};

export const normalizeWorkingHoursConfig = (
  workingHoursRaw: unknown,
  workingDaysRaw?: unknown
): { days: Record<number, WorkingDayConfig> } => {
  const parsedWorkingDays =
    parseWorkingDays(workingDaysRaw) ?? DEFAULT_WORKING_DAYS;
  const enabledDays =
    parsedWorkingDays.length > 0 ? parsedWorkingDays : DEFAULT_WORKING_DAYS;
  const enabledSet = new Set(enabledDays);
  const normalizedWorkingHours = parseWorkingHours(workingHoursRaw);

  if (normalizedWorkingHours && typeof normalizedWorkingHours === 'object') {
    const rawConfig = normalizedWorkingHours as WorkingHoursConfig;
    if (rawConfig.days && typeof rawConfig.days === 'object') {
      const days: Record<number, WorkingDayConfig> = {};
      for (let day = 0; day <= 6; day += 1) {
        const rawDay = rawConfig.days[String(day)] ?? rawConfig.days[day];
        days[day] = normalizeDayConfig(rawDay, enabledSet.has(day));
      }
      return { days };
    }
  }

  if (Array.isArray(normalizedWorkingHours)) {
    const parsedSlots = Array.from(
      new Set(
        normalizedWorkingHours
          .map(toMinutes)
          .filter((value): value is number => value !== null)
          .map(roundToSlot)
      )
    ).sort((a, b) => a - b);

    let startMinutes = DEFAULT_DAY_START_MINUTES;
    let endMinutes = DEFAULT_DAY_END_MINUTES;
    if (parsedSlots.length > 0) {
      startMinutes = parsedSlots[0];
      const lastSlot = parsedSlots[parsedSlots.length - 1];
      endMinutes = Math.min(
        lastSlot + SLOT_INTERVAL_MINUTES,
        24 * 60 - SLOT_INTERVAL_MINUTES
      );
    }

    const days: Record<number, WorkingDayConfig> = {};
    for (let day = 0; day <= 6; day += 1) {
      days[day] = normalizeDayConfig(
        {
          enabled: enabledSet.has(day),
          start: minutesToTime(startMinutes),
          end: minutesToTime(endMinutes),
          breakEnabled: false,
        },
        enabledSet.has(day)
      );
    }
    return { days };
  }

  const days: Record<number, WorkingDayConfig> = {};
  for (let day = 0; day <= 6; day += 1) {
    days[day] = normalizeDayConfig(undefined, enabledSet.has(day));
  }
  return { days };
};

export const buildScheduleByDay = (
  workingHoursRaw: unknown,
  workingDaysRaw?: unknown
): Record<number, WorkingDaySchedule> => {
  const normalized = normalizeWorkingHoursConfig(
    workingHoursRaw,
    workingDaysRaw
  );
  const schedule: Record<number, WorkingDaySchedule> = {};

  for (let day = 0; day <= 6; day += 1) {
    const config = normalized.days[day];
    const startMinutes = toMinutes(config.start) ?? DEFAULT_DAY_START_MINUTES;
    const endMinutes = toMinutes(config.end) ?? DEFAULT_DAY_END_MINUTES;
    const enabled = config.enabled ?? false;

    let breakStartMinutes: number | undefined;
    let breakEndMinutes: number | undefined;
    if (config.breakEnabled) {
      breakStartMinutes =
        toMinutes(config.breakStart) ?? DEFAULT_BREAK_START_MINUTES;
      breakEndMinutes =
        toMinutes(config.breakEnd) ?? DEFAULT_BREAK_END_MINUTES;
      if (breakStartMinutes < startMinutes) {
        breakStartMinutes = startMinutes;
      }
      if (breakEndMinutes > endMinutes) {
        breakEndMinutes = endMinutes;
      }
      if (breakEndMinutes <= breakStartMinutes) {
        breakStartMinutes = undefined;
        breakEndMinutes = undefined;
      }
    }

    schedule[day] = {
      enabled,
      startMinutes,
      endMinutes,
      breakStartMinutes,
      breakEndMinutes,
    };
  }

  return schedule;
};

export const getTimeSlotsForDate = (
  date: Date | undefined,
  workingHoursRaw: unknown,
  workingDaysRaw?: unknown
): string[] => {
  if (!date || isNaN(date.getTime())) return [];
  const scheduleByDay = buildScheduleByDay(workingHoursRaw, workingDaysRaw);
  const daySchedule = scheduleByDay[date.getDay()];
  if (!daySchedule?.enabled) return [];

  const slots: string[] = [];
  for (
    let minuteOfDay = daySchedule.startMinutes;
    minuteOfDay + SLOT_INTERVAL_MINUTES <= daySchedule.endMinutes;
    minuteOfDay += SLOT_INTERVAL_MINUTES
  ) {
    const slotEndMinutes = minuteOfDay + SLOT_INTERVAL_MINUTES;
    if (
      daySchedule.breakStartMinutes !== undefined &&
      daySchedule.breakEndMinutes !== undefined
    ) {
      if (
        minuteOfDay < daySchedule.breakEndMinutes &&
        slotEndMinutes > daySchedule.breakStartMinutes
      ) {
        continue;
      }
    }

    const hour = Math.floor(minuteOfDay / 60);
    const minute = minuteOfDay % 60;
    slots.push(
      `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    );
  }

  return slots;
};
