type IntegrationSettingsLike = {
  googleCalendarEnabled?: boolean | string | null;
  googleCalendarStatus?: string | null;
};

type CalendarStatusLike = {
  connected?: boolean | null;
} | null;

const normalizeEnabledValue = (value: unknown) => {
  if (value === false) return false;
  if (value === true) return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'false') return false;
    if (normalized === 'true') return true;
  }
  return true;
};

export const resolveGoogleCalendarEnabled = (
  settings?: IntegrationSettingsLike | null
) => normalizeEnabledValue(settings?.googleCalendarEnabled);

export const resolveGoogleCalendarConnected = (
  settings?: IntegrationSettingsLike | null,
  calendarStatus?: CalendarStatusLike
) =>
  settings?.googleCalendarStatus === 'connected' ||
  calendarStatus?.connected === true;

export const resolveGoogleCalendarActive = (
  settings?: IntegrationSettingsLike | null,
  calendarStatus?: CalendarStatusLike
) =>
  resolveGoogleCalendarConnected(settings, calendarStatus) &&
  resolveGoogleCalendarEnabled(settings);
