export interface LimitationRule {
  id: string;
  label: string;
  statute: string;
  articleOrSection: string;
  periodUnit: 'days' | 'months' | 'years';
  periodValue: number;
  condonableGraceDays?: number;
  section5Applicable: boolean;
  triggerDescription: string;
  practiceNote: string;
}

export interface LimitationCalculationResult {
  rule: LimitationRule;
  triggerDate: string;
  rawDueDate: string;
  effectiveDueDate: string;
  rolledOverFromSunday: boolean;
  graceDeadlineDate?: string;
  daysRemaining: number;
  urgencyStatus: 'overdue' | 'urgent' | 'approaching' | 'safe';
  guidanceSummary: string;
}

export const LIMITATION_RULES: LimitationRule[] = [
  {
    id: 'arb_sec_34',
    label: 'Arbitral Award Challenge (Sec. 34)',
    statute: 'Arbitration & Conciliation Act, 1996',
    articleOrSection: 'Section 34(3)',
    periodUnit: 'months',
    periodValue: 3,
    condonableGraceDays: 30,
    section5Applicable: false,
    triggerDescription: 'Date on which signed copy of arbitral award was received by the party',
    practiceNote:
      'Strict outer cap of 3 months + 30 days ("but not thereafter"). Section 5 Limitation Act does NOT apply (Union of India v. Popular Construction).',
  },
  {
    id: 'hc_appeal_116a',
    label: 'First Appeal to High Court',
    statute: 'Limitation Act, 1963',
    articleOrSection: 'Article 116(a)',
    periodUnit: 'days',
    periodValue: 90,
    section5Applicable: true,
    triggerDescription: 'Date of decree or order (excluding time requisite for certified copy under Sec. 12)',
    practiceNote: 'Delay beyond 90 days requires an application for condonation under Section 5 showing sufficient cause.',
  },
  {
    id: 'dist_appeal_116b',
    label: 'Appeal to District Court',
    statute: 'Limitation Act, 1963',
    articleOrSection: 'Article 116(b)',
    periodUnit: 'days',
    periodValue: 30,
    section5Applicable: true,
    triggerDescription: 'Date of decree or order appealed against',
    practiceNote: 'Exclude certified copy preparation period under Section 12(2) Limitation Act.',
  },
  {
    id: 'slp_sc_133',
    label: 'Special Leave Petition (Supreme Court)',
    statute: 'Limitation Act, 1963',
    articleOrSection: 'Article 133(c)',
    periodUnit: 'days',
    periodValue: 90,
    section5Applicable: true,
    triggerDescription: 'Date of High Court judgment or order (60 days where certificate refused)',
    practiceNote: 'File IA for condonation of delay under Sec. 5 if crossing 90 days; attach certified copy receipt.',
  },
  {
    id: 'commercial_appeal_13',
    label: 'Commercial Court Appeal (Sec. 13)',
    statute: 'Commercial Courts Act, 2015',
    articleOrSection: 'Section 13(1A)',
    periodUnit: 'days',
    periodValue: 60,
    section5Applicable: true,
    triggerDescription: 'Date of judgment or order of Commercial Court / Commercial Division',
    practiceNote: 'Courts apply heightened scrutiny to condonation of delay in commercial appeals (Government of Maharashtra v. Borse Brothers).',
  },
  {
    id: 'ibc_nclat_61',
    label: 'IBC Appeal to NCLAT (Sec. 61)',
    statute: 'Insolvency and Bankruptcy Code, 2016',
    articleOrSection: 'Section 61(2)',
    periodUnit: 'days',
    periodValue: 30,
    condonableGraceDays: 15,
    section5Applicable: false,
    triggerDescription: 'Date of pronouncement of NCLT order',
    practiceNote: 'Maximum condonable window is strictly 15 days beyond 30 days (National Spot Exchange v. Anil Kohli).',
  },
  {
    id: 'review_124',
    label: 'Review of Judgment / Decree',
    statute: 'Limitation Act, 1963',
    articleOrSection: 'Article 124',
    periodUnit: 'days',
    periodValue: 30,
    section5Applicable: true,
    triggerDescription: 'Date of decree or order sought to be reviewed',
    practiceNote: 'Applies to courts other than Supreme Court (SC review also 30 days under Order XLVII SC Rules).',
  },
  {
    id: 'civil_suit_113',
    label: 'Civil Suit for Money / Breach of Contract',
    statute: 'Limitation Act, 1963',
    articleOrSection: 'Article 55 / Article 113',
    periodUnit: 'years',
    periodValue: 3,
    section5Applicable: false,
    triggerDescription: 'Date when the breach occurs or right to sue first accrues',
    practiceNote: 'Section 5 does not extend limitation for original suits; check Sec. 18 (written acknowledgement) or Sec. 19 (part payment).',
  },
  {
    id: 'consumer_69',
    label: 'Consumer Complaint (CPA 2019)',
    statute: 'Consumer Protection Act, 2019',
    articleOrSection: 'Section 69',
    periodUnit: 'years',
    periodValue: 2,
    section5Applicable: true,
    triggerDescription: 'Date on which the cause of action has arisen',
    practiceNote: 'Commission may condone delay if complainant shows sufficient cause recorded in writing.',
  },
  {
    id: 'ni_138_notice',
    label: 'Cheque Dishonour Statutory Demand Notice',
    statute: 'Negotiable Instruments Act, 1881',
    articleOrSection: 'Section 138(b)',
    periodUnit: 'days',
    periodValue: 30,
    section5Applicable: false,
    triggerDescription: 'Date of receipt of bank return memo indicating dishonour',
    practiceNote: 'Non-condonable 30-day statutory notice period; complaint must follow within 30 days after expiry of 15-day drawer cure window.',
  },
];

function parseIsoDateUTC(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) {
    throw new Error(`Invalid ISO date format: ${iso}`);
  }
  return new Date(Date.UTC(y, m - 1, d));
}

function formatIsoDateUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addPeriodUTC(base: Date, unit: LimitationRule['periodUnit'], value: number): Date {
  const next = new Date(base.getTime());
  if (unit === 'days') {
    next.setUTCDate(next.getUTCDate() + value);
  } else if (unit === 'months') {
    const targetDay = next.getUTCDate();
    next.setUTCMonth(next.getUTCMonth() + value);
    // Clamp month-end overflow (e.g., Jan 31 + 3 months -> Apr 30)
    if (next.getUTCDate() < targetDay) {
      next.setUTCDate(0);
    }
  } else {
    next.setUTCFullYear(next.getUTCFullYear() + value);
  }
  return next;
}

export function calculateLimitationDeadline(
  ruleId: string,
  triggerDateIso: string,
  referenceDateIso?: string
): LimitationCalculationResult {
  const rule = LIMITATION_RULES.find((r) => r.id === ruleId);
  if (!rule) {
    throw new Error(`Unknown limitation rule: ${ruleId}`);
  }

  const triggerDate = parseIsoDateUTC(triggerDateIso);
  const rawDue = addPeriodUTC(triggerDate, rule.periodUnit, rule.periodValue);
  const rawDueIso = formatIsoDateUTC(rawDue);

  // Section 4 Limitation Act: if prescribed period expires on a Sunday (court closed), rolls to Monday
  let effectiveDue = new Date(rawDue.getTime());
  let rolledOverFromSunday = false;
  if (effectiveDue.getUTCDay() === 0) {
    effectiveDue.setUTCDate(effectiveDue.getUTCDate() + 1);
    rolledOverFromSunday = true;
  }
  const effectiveDueIso = formatIsoDateUTC(effectiveDue);

  let graceDeadlineDate: string | undefined;
  if (rule.condonableGraceDays && rule.condonableGraceDays > 0) {
    const grace = addPeriodUTC(rawDue, 'days', rule.condonableGraceDays);
    if (grace.getUTCDay() === 0) {
      grace.setUTCDate(grace.getUTCDate() + 1);
    }
    graceDeadlineDate = formatIsoDateUTC(grace);
  }

  const refDate = referenceDateIso
    ? parseIsoDateUTC(referenceDateIso)
    : parseIsoDateUTC(new Date().toISOString().slice(0, 10));

  const diffMs = effectiveDue.getTime() - refDate.getTime();
  const daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24));

  let urgencyStatus: LimitationCalculationResult['urgencyStatus'];
  if (daysRemaining < 0) {
    urgencyStatus = 'overdue';
  } else if (daysRemaining <= 7) {
    urgencyStatus = 'urgent';
  } else if (daysRemaining <= 30) {
    urgencyStatus = 'approaching';
  } else {
    urgencyStatus = 'safe';
  }

  const graceNote = graceDeadlineDate
    ? ` Outer condonable cap expires on ${graceDeadlineDate} (+${rule.condonableGraceDays} days).`
    : rule.section5Applicable
      ? ' Condonation under Section 5 Limitation Act may be sought on sufficient cause.'
      : ' Strict statutory period — Section 5 condonation does not apply.';

  const rolloverNote = rolledOverFromSunday
    ? ` Rolled over from Sunday (${rawDueIso}) to Monday (${effectiveDueIso}) under Section 4 Limitation Act.`
    : '';

  return {
    rule,
    triggerDate: triggerDateIso,
    rawDueDate: rawDueIso,
    effectiveDueDate: effectiveDueIso,
    rolledOverFromSunday,
    graceDeadlineDate,
    daysRemaining,
    urgencyStatus,
    guidanceSummary: `Prescribed period under ${rule.statute} (${rule.articleOrSection}) expires on ${effectiveDueIso}.${rolloverNote}${graceNote}`,
  };
}
