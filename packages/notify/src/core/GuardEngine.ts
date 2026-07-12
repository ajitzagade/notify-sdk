import { RecipientPreference, NotifyConfig } from '../types';

export interface GuardResult {
  allowed: boolean;
  reason?: 'no_preference_record' | 'not_opted_in' | 'muted' | 'quiet_hours';
}

export class GuardEngine {
  private defaults: NonNullable<NotifyConfig['defaults']>;

  constructor(defaults: NotifyConfig['defaults'] = {}) {
    this.defaults = defaults;
  }

  check(phone: string, pref: RecipientPreference | null): GuardResult {
    if (!pref) {
      return { allowed: false, reason: 'no_preference_record' };
    }

    if (!pref.optedIn) {
      return { allowed: false, reason: 'not_opted_in' };
    }

    if (pref.mutedUntil && new Date(pref.mutedUntil) > new Date()) {
      return { allowed: false, reason: 'muted' };
    }

    const qh = pref.quietHours ?? this.defaults.quietHours;
    if (qh) {
      const tz   = pref.timezone ?? this.defaults.timezone ?? 'UTC';
      const hour = this.getCurrentHour(tz);

      const inQuiet =
        qh.start > qh.end
          ? hour >= qh.start || hour < qh.end   // overnight e.g. 22–8
          : hour >= qh.start && hour < qh.end;   // same-day e.g. 13–15

      if (inQuiet) {
        return { allowed: false, reason: 'quiet_hours' };
      }
    }

    return { allowed: true };
  }

  private getCurrentHour(timezone: string): number {
    try {
      return parseInt(
        new Intl.DateTimeFormat('en', {
          hour:     'numeric',
          hour12:   false,
          timeZone: timezone,
        }).format(new Date()),
        10
      );
    } catch {
      return new Date().getUTCHours();
    }
  }
}
