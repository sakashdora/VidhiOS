import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Briefcase,
  Check,
  CheckCircle2,
  FileDown,
  Gavel,
  GraduationCap,
  Languages,
  Menu,
  RefreshCw,
  RotateCcw,
  Scale,
  ShieldCheck,
  X,
} from 'lucide-react';
import { api, setAuthToken } from '../lib/api';
import {
  applyCitationReplacements,
  scanDraftForLegacyCitations,
} from '../lib/legal/statuteCrosswalk';
import {
  calculateLimitationDeadline,
  LIMITATION_RULES,
} from '../lib/legal/limitationCalculator';
import type { JurisdictionMode, UserProfile } from '../types/legal';

import benchImg from '../assets/images/vidhios_bench_judiciary_1795319806872.jpg';
import chambersImg from '../assets/images/vidhios_advocate_chambers_1795319807173.jpg';
import libraryImg from '../assets/images/vidhios_law_library_1795319806069.jpg';

interface AuthGateProps {
  onAuthenticated: (user: UserProfile) => void;
}

type HeroSandboxTab = 'bns' | 'limitation' | 'redline';
type AudienceRoleId = 'judges' | 'advocates' | 'students';

interface AudienceRole {
  id: AudienceRoleId;
  shortLabel: string;
  title: string;
  subtitle: string;
  image: string;
  imageAlt: string;
  summary: string;
  benefits: string[];
  ctaLabel: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

const DEFAULT_HERO_DRAFT =
  'Application u/s 438 CrPC seeking anticipatory bail in FIR alleging offences under Section 420 IPC and Section 406 IPC, supported by electronic records certified under Section 65B IEA.';

const AUDIENCE_ROLES: AudienceRole[] = [
  {
    id: 'judges',
    shortLabel: 'Judges',
    title: 'For Hon’ble Judges & Judicial Officers',
    subtitle: 'Bench Research · Record Audit · Chronology',
    image: benchImg,
    imageAlt: 'Judicial chambers desk with scales of justice and bound law reporters',
    summary:
      'Review lengthy case files, cross-check rival submissions against Supreme Court & High Court ratios, and spot factual contradictions across annexures.',
    benefits: [
      'Chronology & List of Dates extracted from voluminous petitions and FIRs',
      'Cross-document contradiction check across dates, amounts, and statements',
      'Supreme Court & High Court precedent lookup with structured citations',
      'Side-by-side IPC, CrPC & Evidence Act to BNS, BNSS & BSA 2023 mapping',
    ],
    ctaLabel: 'Open Judicial Workspace',
    icon: Gavel,
  },
  {
    id: 'advocates',
    shortLabel: 'Advocates',
    title: 'For Advocates & Litigation Chambers',
    subtitle: 'Court Drafting · .DOCX Export · Case Tracker',
    image: chambersImg,
    imageAlt: 'Advocate chambers table with ribbon-bound court briefs and fountain pen',
    summary:
      'Draft registry-ready affidavits, bail applications, writs, SLPs, and contract redlines. Export formatted Microsoft Word (.DOCX) filings and track hearing dates.',
    benefits: [
      '13 Indian Judiciary Forms (482 BNSS, 63 BSA, SLP, Writ, Vakalatnama) in .DOCX',
      'Live BNS / BNSS / BSA validator updates repealed IPC/CrPC/IEA sections',
      'Indian Limitation Act & Arbitration Sec. 34 calculator with Sunday roll-forward',
      'Contract redlining with side-by-side diffs and Hindi/English assistant',
    ],
    ctaLabel: 'Open Advocate Chambers',
    icon: Briefcase,
  },
  {
    id: 'students',
    shortLabel: 'Law Students',
    title: 'For Law Students & Exam Aspirants',
    subtitle: 'BNS Mastery · Moot Court · Bilingual Study',
    image: libraryImg,
    imageAlt: 'Law school library and moot court hall with students studying case reporters',
    summary:
      'Practice courtroom drafting and research skills. Rehearse moot court arguments against an interactive Bench and master BNS, BNSS, and BSA in English or हिंदी.',
    benefits: [
      'Moot Court & Courtroom Simulator with Bench questioning and rebuttal notes',
      'IPC → BNS, CrPC → BNSS, and IEA → BSA 2023 reference for PCS-J, AIBE & LL.B.',
      'Structured IRAC case briefs and Supreme Court ratio decidendi summaries',
      'Ask legal questions and practice pleadings in English, हिंदी, or Hinglish',
    ],
    ctaLabel: 'Open Student Mode',
    icon: GraduationCap,
  },
];

export function AuthGate({ onAuthenticated }: AuthGateProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AudienceRoleId>('advocates');
  const [heroTab, setHeroTab] = useState<HeroSandboxTab>('bns');
  const [heroDraft, setHeroDraft] = useState<string>(DEFAULT_HERO_DRAFT);
  const [heroRuleId, setHeroRuleId] = useState<string>(LIMITATION_RULES[0].id);
  const [heroTriggerDate, setHeroTriggerDate] = useState<string>(
    new Date(Date.now() - 18 * 86400000).toISOString().slice(0, 10)
  );
  const [heroRedlineDecision, setHeroRedlineDecision] = useState<'pending' | 'accepted' | 'rejected'>('pending');

  // Sign-In / Register State
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [organization, setOrganization] = useState('');
  const [defaultJurisdiction, setDefaultJurisdiction] =
    useState<JurisdictionMode>('india_litigation');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authCardRef = useRef<HTMLDivElement | null>(null);
  const audiencesSectionRef = useRef<HTMLElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  const heroLegacyMatches = useMemo(
    () => scanDraftForLegacyCitations(heroDraft),
    [heroDraft]
  );

  const heroLimitation = useMemo(() => {
    try {
      return calculateLimitationDeadline(heroRuleId, heroTriggerDate);
    } catch {
      return null;
    }
  }, [heroRuleId, heroTriggerDate]);

  const handleHeroUpgradeCitations = () => {
    if (heroLegacyMatches.length === 0) return;
    setHeroDraft(applyCitationReplacements(heroDraft, heroLegacyMatches));
  };

  const scrollToAuth = (targetMode: 'login' | 'register') => {
    setMode(targetMode);
    setError(null);
    setMobileNavOpen(false);
    authCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => emailInputRef.current?.focus(), 350);
  };

  const focusAudienceRole = (roleId: AudienceRoleId) => {
    setSelectedRole(roleId);
    audiencesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res =
        mode === 'login'
          ? await api.login(email, password)
          : await api.register({
              email,
              password,
              fullName,
              organization,
              defaultJurisdiction,
            });
      setAuthToken(res.token, res.csrfToken);
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoEntry = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.demoLogin();
      setAuthToken(res.token, res.csrfToken);
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open demo workspace.');
    } finally {
      setSubmitting(false);
    }
  };

  const currentRole = AUDIENCE_ROLES.find((r) => r.id === selectedRole) ?? AUDIENCE_ROLES[0];

  return (
    <div className="min-h-screen neu-canvas flex flex-col">
      {/* Compact Sticky Header */}
      <header className="sticky top-0 z-40 px-4 sm:px-6 pt-2.5 pb-2 bg-[#efeae0]/90 dark:bg-[#121819]/90 backdrop-blur-md">
        <div className="max-w-[1240px] mx-auto rounded-2xl bg-[#faf7f0]/95 dark:bg-[#192224]/95 border border-[#ddd5c5] dark:border-[#263336] shadow-sm px-4 sm:px-6 h-14 flex items-center justify-between gap-6">
          <a
            href="#top"
            className="inline-flex items-center gap-2.5 font-display text-lg font-bold tracking-tight text-ink whitespace-nowrap shrink-0"
          >
            <span className="w-8 h-8 rounded-xl bg-[#0f5a5f] dark:bg-[#14777e] text-[#faf8f4] flex items-center justify-center shadow-xs shrink-0">
              <Scale className="w-4 h-4" strokeWidth={2} />
            </span>
            <span>VidhiOS</span>
          </a>

          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-ink-secondary"
          >
            <a href="#live-tools" className="py-1 hover:text-ink transition-colors whitespace-nowrap">
              Live Tools
            </a>
            <a href="#audiences" className="py-1 hover:text-ink transition-colors whitespace-nowrap">
              Who It’s For
            </a>
            <a href="#capabilities" className="py-1 hover:text-ink transition-colors whitespace-nowrap">
              Capabilities
            </a>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => scrollToAuth('register')}
              className="hidden sm:inline-flex px-3.5 py-2 rounded-full text-xs font-semibold text-ink-secondary hover:text-ink transition-colors whitespace-nowrap"
            >
              Create Account
            </button>
            <button
              type="button"
              onClick={handleDemoEntry}
              disabled={submitting}
              className="neu-btn-primary px-4 sm:px-5 py-2 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              {submitting ? 'Opening...' : 'Open Demo'}
            </button>
            <button
              type="button"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileNavOpen}
              className="md:hidden neu-btn-secondary p-2 rounded-xl shrink-0"
            >
              {mobileNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <nav
            aria-label="Mobile navigation"
            className="md:hidden mt-2 max-w-[1240px] mx-auto rounded-2xl bg-[#faf7f0] dark:bg-[#192224] border border-[#ddd5c5] dark:border-[#263336] shadow-md p-3 flex flex-col gap-1 text-sm font-medium text-ink-secondary"
          >
            <a
              href="#live-tools"
              onClick={() => setMobileNavOpen(false)}
              className="px-3 py-2.5 rounded-xl hover:bg-[#efe9dc] dark:hover:bg-[#151d1f] hover:text-ink"
            >
              Live Legal Tools
            </a>
            <a
              href="#audiences"
              onClick={() => setMobileNavOpen(false)}
              className="px-3 py-2.5 rounded-xl hover:bg-[#efe9dc] dark:hover:bg-[#151d1f] hover:text-ink"
            >
              Judges, Advocates &amp; Law Students
            </a>
            <a
              href="#capabilities"
              onClick={() => setMobileNavOpen(false)}
              className="px-3 py-2.5 rounded-xl hover:bg-[#efe9dc] dark:hover:bg-[#151d1f] hover:text-ink"
            >
              Workspace Capabilities
            </a>
          </nav>
        )}
      </header>

      <main id="top" className="flex-1">
        {/* SECTION 1: Above-the-Fold Editorial Hero + Direct Sign-In / Register Card */}
        <section className="max-w-[1240px] mx-auto px-4 sm:px-6 pt-6 pb-12 lg:pt-10 lg:pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
            {/* Left: Clear Value Proposition & Proof */}
            <div className="lg:col-span-7 space-y-6 pt-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#dfeceb] dark:bg-[#132e31] text-teal-accent text-xs font-semibold">
                <Scale className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                <span>Built for Judges, Advocates &amp; Law Students</span>
              </div>

              <h1 className="font-display font-bold tracking-tight text-ink leading-[1.08] text-[clamp(2rem,3.8vw,3.25rem)]">
                Legal research, court drafting, and BNS validation in one workspace.
              </h1>

              <p className="text-sm sm:text-base leading-relaxed text-ink-secondary max-w-2xl">
                Research Supreme Court &amp; High Court judgments, convert repealed IPC/CrPC/IEA
                sections to BNS/BNSS/BSA, export court-ready <strong className="text-ink">.DOCX</strong>{' '}
                pleadings, and work in <strong className="text-ink">English or हिंदी</strong>.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleDemoEntry}
                  disabled={submitting}
                  className="neu-btn-primary inline-flex items-center gap-2 px-5 py-3 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap disabled:opacity-50"
                >
                  <span>Open Demo Workspace</span>
                  <ArrowRight className="w-4 h-4 shrink-0" strokeWidth={2} />
                </button>
                <a
                  href="#live-tools"
                  className="neu-btn-secondary inline-flex items-center gap-2 px-5 py-3 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap"
                >
                  <span>Try Live Legal Engines</span>
                </a>
              </div>

              {/* Role Quick-Jump Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {AUDIENCE_ROLES.map((role) => {
                  const Icon = role.icon;
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => focusAudienceRole(role.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-ink-secondary bg-[#faf7f0] dark:bg-[#192224] border border-stone-hairline hover:border-[#0f5a5f] hover:text-ink transition-colors"
                    >
                      <Icon className="w-3.5 h-3.5 text-teal-accent" strokeWidth={2} />
                      <span>{role.shortLabel}</span>
                    </button>
                  );
                })}
              </div>

              {/* Compact 4-Metric Strip */}
              <div className="pt-6 border-t border-stone-hairline grid grid-cols-2 sm:grid-cols-4 gap-5">
                <div>
                  <p className="font-mono text-xl sm:text-2xl font-semibold tabular-nums text-teal-accent">
                    13
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-ink">Judiciary Forms</p>
                  <p className="text-[11px] text-ink-muted">.DOCX court export</p>
                </div>
                <div>
                  <p className="font-mono text-xl sm:text-2xl font-semibold tabular-nums text-teal-accent">
                    52+
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-ink">Statute Mappings</p>
                  <p className="text-[11px] text-ink-muted">IPC/CrPC/IEA → BNS</p>
                </div>
                <div>
                  <p className="font-mono text-xl sm:text-2xl font-semibold tabular-nums text-teal-accent">
                    EN + हिंदी
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-ink">Bilingual Mode</p>
                  <p className="text-[11px] text-ink-muted">Hindi &amp; English drafts</p>
                </div>
                <div>
                  <p className="font-mono text-xl sm:text-2xl font-semibold tabular-nums text-teal-accent">
                    Sec. 4 &amp; 34
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-ink">Limitation Math</p>
                  <p className="text-[11px] text-ink-muted">Deterministic dates</p>
                </div>
              </div>
            </div>

            {/* Right: Immediate Sign-In / Create Account Card */}
            <div ref={authCardRef} id="chambers-access" className="lg:col-span-5 scroll-mt-24">
              <div className="neu-card rounded-3xl p-6 sm:p-7">
                <div className="flex items-center justify-between gap-3 pb-4 border-b border-stone-hairline">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-ink">
                      {mode === 'login' ? 'Sign In to Chambers' : 'Create Your Account'}
                    </h2>
                    <p className="text-xs text-ink-muted mt-0.5">
                      Private, isolated legal workspace
                    </p>
                  </div>
                  <div className="neu-tab-bar rounded-xl px-1.5 py-1 flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setError(null);
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap border-b-2 ${
                        mode === 'login'
                          ? 'border-[#0f5a5f] dark:border-[#57c5cc] text-teal-accent'
                          : 'border-transparent text-ink-muted hover:text-ink'
                      }`}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('register');
                        setError(null);
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap border-b-2 ${
                        mode === 'register'
                          ? 'border-[#0f5a5f] dark:border-[#57c5cc] text-teal-accent'
                          : 'border-transparent text-ink-muted hover:text-ink'
                      }`}
                    >
                      Register
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                  {mode === 'register' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="auth-fullname" className="block text-xs font-medium text-ink-secondary mb-1.5">
                          Full Name
                        </label>
                        <input
                          id="auth-fullname"
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Adv. / Hon'ble / Name"
                          className="neu-input w-full px-3.5 py-2.5 text-sm rounded-xl"
                        />
                      </div>
                      <div>
                        <label htmlFor="auth-org" className="block text-xs font-medium text-ink-secondary mb-1.5">
                          Court / Chambers / School
                        </label>
                        <input
                          id="auth-org"
                          type="text"
                          value={organization}
                          onChange={(e) => setOrganization(e.target.value)}
                          placeholder="High Court / Chambers"
                          className="neu-input w-full px-3.5 py-2.5 text-sm rounded-xl"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label htmlFor="auth-email" className="block text-xs font-medium text-ink-secondary mb-1.5">
                      Email Address
                    </label>
                    <input
                      ref={emailInputRef}
                      id="auth-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@chambers.in"
                      className="neu-input w-full px-3.5 py-2.5 text-sm rounded-xl"
                    />
                  </div>

                  <div>
                    <label htmlFor="auth-password" className="block text-xs font-medium text-ink-secondary mb-1.5">
                      Password
                    </label>
                    <input
                      id="auth-password"
                      type="password"
                      required
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      minLength={mode === 'register' ? 8 : 1}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === 'register' ? 'Minimum 8 characters' : 'Enter your password'}
                      className="neu-input w-full px-3.5 py-2.5 text-sm rounded-xl"
                    />
                  </div>

                  {mode === 'register' && (
                    <div>
                      <label htmlFor="auth-jurisdiction" className="block text-xs font-medium text-ink-secondary mb-1.5">
                        Primary Practice Area
                      </label>
                      <select
                        id="auth-jurisdiction"
                        value={defaultJurisdiction}
                        onChange={(e) => setDefaultJurisdiction(e.target.value as JurisdictionMode)}
                        className="neu-input w-full px-3.5 py-2.5 text-sm rounded-xl"
                      >
                        <option value="india_litigation">Indian Courts &amp; Litigation (BNS/BNSS/BSA)</option>
                        <option value="corporate_ma">Corporate Law, M&amp;A &amp; Commercial Contracts</option>
                        <option value="global_multi">International Arbitration &amp; Comparative Law</option>
                      </select>
                    </div>
                  )}

                  {error && (
                    <div
                      role="alert"
                      className="p-3 rounded-xl border border-[#b23a32]/40 bg-[#b23a32]/8 text-xs text-[#9c2f28] dark:text-[#f29b94]"
                    >
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="neu-btn-primary w-full py-3 px-5 rounded-full text-sm font-semibold flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50"
                  >
                    <span>
                      {submitting
                        ? 'Authenticating...'
                        : mode === 'login'
                          ? 'Sign In to Workspace'
                          : 'Create Account & Launch'}
                    </span>
                    <ArrowRight className="w-4 h-4" strokeWidth={2} />
                  </button>
                </form>

                <div className="mt-5 pt-4 border-t border-stone-hairline flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted">
                    <ShieldCheck className="w-3.5 h-3.5 text-teal-accent shrink-0" />
                    <span>Per-user isolated matters</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleDemoEntry}
                    disabled={submitting}
                    className="text-xs font-semibold text-teal-accent hover:underline whitespace-nowrap disabled:opacity-50"
                  >
                    Instant Demo →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: Live Interactive Legal Sandbox (#live-tools) */}
        <section id="live-tools" className="scroll-mt-24 max-w-[1240px] mx-auto px-4 sm:px-6 pb-14">
          <div className="neu-card rounded-3xl p-5 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-stone-hairline">
              <div>
                <p className="font-mono text-[11px] font-semibold text-teal-accent">
                  Interactive Legal Engines
                </p>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-ink mt-0.5">
                  Test statutory mapping, limitation math, and clause redlines live
                </h2>
              </div>

              <div
                role="tablist"
                aria-label="Interactive legal tools"
                className="neu-tab-bar rounded-xl px-1.5 py-1 flex items-center gap-1 shrink-0 overflow-x-auto"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={heroTab === 'bns'}
                  onClick={() => setHeroTab('bns')}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap border-b-2 ${
                    heroTab === 'bns'
                      ? 'border-[#0f5a5f] dark:border-[#57c5cc] text-teal-accent'
                      : 'border-transparent text-ink-muted hover:text-ink'
                  }`}
                >
                  BNS Audit
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={heroTab === 'limitation'}
                  onClick={() => setHeroTab('limitation')}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap border-b-2 ${
                    heroTab === 'limitation'
                      ? 'border-[#0f5a5f] dark:border-[#57c5cc] text-teal-accent'
                      : 'border-transparent text-ink-muted hover:text-ink'
                  }`}
                >
                  Limitation Math
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={heroTab === 'redline'}
                  onClick={() => setHeroTab('redline')}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap border-b-2 ${
                    heroTab === 'redline'
                      ? 'border-[#0f5a5f] dark:border-[#57c5cc] text-teal-accent'
                      : 'border-transparent text-ink-muted hover:text-ink'
                  }`}
                >
                  Clause Redline
                </button>
              </div>
            </div>

            {heroTab === 'bns' && (
              <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-6 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="hero-bns-editor" className="text-xs font-medium text-ink-secondary">
                      Pleading Excerpt (Scans Live for IPC / CrPC / IEA)
                    </label>
                    <button
                      type="button"
                      onClick={() => setHeroDraft(DEFAULT_HERO_DRAFT)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-muted hover:text-teal-accent whitespace-nowrap"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset Sample</span>
                    </button>
                  </div>
                  <textarea
                    id="hero-bns-editor"
                    rows={5}
                    value={heroDraft}
                    onChange={(e) => setHeroDraft(e.target.value)}
                    className="neu-input w-full p-3.5 text-xs sm:text-sm leading-relaxed rounded-2xl resize-none"
                  />
                </div>

                <div className="lg:col-span-6">
                  {heroLegacyMatches.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#9c2f28] dark:text-[#f29b94]">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                          <span className="font-mono tabular-nums">
                            {heroLegacyMatches.length} repealed citation(s) found
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={handleHeroUpgradeCitations}
                          className="neu-btn-primary inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap"
                        >
                          <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} />
                          <span>Upgrade All Citations</span>
                        </button>
                      </div>

                      <div className="divide-y divide-[#ddd5c5] dark:divide-[#263336] border-t border-stone-hairline max-h-[164px] overflow-y-auto pr-1">
                        {heroLegacyMatches.map((m) => (
                          <div key={m.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                            <span className="font-mono font-semibold text-[#9c2f28] dark:text-[#f29b94] whitespace-nowrap">
                              {m.matchedText}
                            </span>
                            <span className="font-mono text-[#156a53] dark:text-emerald-400 truncate text-right">
                              → Section {m.mapping.newSection} {m.mapping.newCode}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl border border-[#156a53]/30 bg-[#156a53]/8 flex items-start gap-3">
                      <CheckCircle2 className="w-4 h-4 text-[#156a53] dark:text-emerald-400 shrink-0 mt-0.5" strokeWidth={2} />
                      <div className="text-xs">
                        <p className="font-semibold text-[#115442] dark:text-emerald-200">
                          BNS / BNSS / BSA 2023 Compliant
                        </p>
                        <p className="text-[#156a53] dark:text-emerald-400 mt-0.5 leading-relaxed">
                          All repealed citations have been updated with their corresponding 2023 provisions.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {heroTab === 'limitation' && (
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="hero-lim-rule" className="block text-xs font-medium text-ink-secondary mb-1.5">
                      Legal Remedy / Petition Type
                    </label>
                    <select
                      id="hero-lim-rule"
                      value={heroRuleId}
                      onChange={(e) => setHeroRuleId(e.target.value)}
                      className="neu-input w-full px-3.5 py-2.5 text-xs rounded-xl"
                    >
                      {LIMITATION_RULES.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="hero-lim-date" className="block text-xs font-medium text-ink-secondary mb-1.5">
                      Order / Award Receipt Date
                    </label>
                    <input
                      id="hero-lim-date"
                      type="date"
                      value={heroTriggerDate}
                      onChange={(e) => setHeroTriggerDate(e.target.value)}
                      className="neu-input w-full px-3.5 py-2.5 text-xs font-mono rounded-xl"
                    />
                  </div>
                </div>

                {heroLimitation && (
                  <div className="neu-inset rounded-2xl p-4 space-y-3">
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <p className="text-ink-muted">Last Filing Date</p>
                        <p className="mt-1 font-mono text-sm sm:text-base font-semibold tabular-nums text-ink">
                          {heroLimitation.effectiveDueDate}
                        </p>
                      </div>
                      <div>
                        <p className="text-ink-muted">Time Left</p>
                        <p className="mt-1 font-mono text-sm sm:text-base font-semibold tabular-nums text-teal-accent">
                          {heroLimitation.daysRemaining >= 0
                            ? `${heroLimitation.daysRemaining} days`
                            : `${Math.abs(heroLimitation.daysRemaining)}d past`}
                        </p>
                      </div>
                      <div>
                        <p className="text-ink-muted">Outer Cap</p>
                        <p className="mt-1 font-mono text-sm sm:text-base font-semibold tabular-nums text-[#b86b14] dark:text-amber-400">
                          {heroLimitation.graceDeadlineDate ?? 'Sec. 5'}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed text-ink-secondary border-t border-stone-hairline pt-2.5">
                      {heroLimitation.guidanceSummary}
                    </p>
                  </div>
                )}
              </div>
            )}

            {heroTab === 'redline' && (
              <div className="mt-5 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs">
                    <span className="font-mono font-semibold text-ink">Clause 8.2</span>
                    <span aria-hidden="true" className="mx-1.5 text-ink-muted">·</span>
                    <span className="font-semibold text-[#9c2f28] dark:text-[#f29b94]">
                      Unlimited One-Sided Indemnity
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setHeroRedlineDecision('accepted')}
                      className={`inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                        heroRedlineDecision === 'accepted'
                          ? 'bg-[#156a53] text-[#faf8f4] shadow-sm'
                          : 'neu-btn-secondary'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                      <span>Accept Redline</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHeroRedlineDecision('rejected')}
                      className={`inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                        heroRedlineDecision === 'rejected'
                          ? 'bg-[#4e5b5d] text-[#faf8f4] shadow-sm'
                          : 'neu-btn-secondary'
                      }`}
                    >
                      <X className="w-3.5 h-3.5" strokeWidth={2} />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs leading-relaxed">
                  <div className="p-3.5 rounded-2xl bg-[#b23a32]/7 border border-[#b23a32]/25">
                    <p className="font-mono text-[11px] font-semibold text-[#9c2f28] dark:text-[#f29b94] mb-1">
                      Counterparty Draft
                    </p>
                    <p className="text-ink line-through decoration-[#b23a32]/65">
                      Customer shall indemnify Vendor for all direct, indirect, or consequential losses without monetary cap.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#156a53]/8 border border-[#156a53]/25">
                    <p className="font-mono text-[11px] font-semibold text-[#156a53] dark:text-emerald-400 mb-1">
                      Balanced Fair Clause
                    </p>
                    <p className="text-ink">
                      Mutual indemnity limited to direct third-party claims, excluding indirect losses, capped at 12-month fees.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-hairline text-xs">
                  <span className="text-ink-muted">
                    Basis: Sec. 73 Indian Contract Act bars remote indirect damages.
                  </span>
                  <span
                    className={`font-mono font-semibold whitespace-nowrap shrink-0 ${
                      heroRedlineDecision === 'accepted'
                        ? 'text-[#156a53] dark:text-emerald-400'
                        : heroRedlineDecision === 'rejected'
                          ? 'text-ink-muted'
                          : 'text-[#b86b14] dark:text-amber-400'
                    }`}
                  >
                    {heroRedlineDecision === 'accepted'
                      ? 'Redline Accepted'
                      : heroRedlineDecision === 'rejected'
                        ? 'Original Retained'
                        : 'Pending Review'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* SECTION 3: Role-Focused Workflows (#audiences) */}
        <section
          id="audiences"
          ref={audiencesSectionRef}
          className="scroll-mt-20 border-y border-stone-hairline bg-[#f3eee4]/75 dark:bg-[#161e20]/75 py-14 lg:py-16"
        >
          <div className="max-w-[1240px] mx-auto px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-teal-accent">Role-Specific Workflows</p>
                <h2 className="mt-1.5 font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                  Tailored for Judges, Advocates &amp; Law Students
                </h2>
              </div>

              <div
                role="tablist"
                aria-label="Select legal audience role"
                className="neu-tab-bar rounded-2xl p-1.5 flex items-center gap-1 shrink-0"
              >
                {AUDIENCE_ROLES.map((role) => {
                  const active = role.id === selectedRole;
                  return (
                    <button
                      key={role.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setSelectedRole(role.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                        active
                          ? 'bg-[#0f5a5f] dark:bg-[#14777e] text-[#faf8f4] shadow-xs'
                          : 'text-ink-secondary hover:text-ink'
                      }`}
                    >
                      {role.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-7 neu-card rounded-3xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
              <div className="lg:col-span-5 relative min-h-[240px] sm:min-h-[320px] bg-[#dfd7c8] dark:bg-[#1d292c] overflow-hidden">
                <img
                  src={currentRole.image}
                  alt={currentRole.imageAlt}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-[#121819]/70 via-[#121819]/15 to-transparent pointer-events-none"
                />
                <p className="absolute bottom-4 left-5 right-5 text-xs font-mono text-[#e6f3f4]">
                  {currentRole.subtitle}
                </p>
              </div>

              <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between">
                <div>
                  <h3 className="font-display text-xl sm:text-2xl font-bold text-ink">
                    {currentRole.title}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-ink-secondary">
                    {currentRole.summary}
                  </p>

                  <ul className="mt-5 space-y-2.5 border-t border-stone-hairline pt-4">
                    {currentRole.benefits.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm text-ink-secondary">
                        <CheckCircle2
                          className="w-4 h-4 text-teal-accent shrink-0 mt-0.5"
                          strokeWidth={2}
                        />
                        <span className="leading-snug">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 pt-4 border-t border-stone-hairline flex flex-wrap items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={handleDemoEntry}
                    disabled={submitting}
                    className="neu-btn-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap disabled:opacity-50"
                  >
                    <span>{currentRole.ctaLabel}</span>
                    <ArrowRight className="w-4 h-4" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToAuth('register')}
                    className="text-xs font-semibold text-teal-accent hover:underline whitespace-nowrap"
                  >
                    Create Account →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: Core Workspace Capabilities (#capabilities) */}
        <section id="capabilities" className="scroll-mt-20 max-w-[1240px] mx-auto px-4 sm:px-6 py-14 lg:py-16">
          <div className="max-w-2xl mb-8">
            <p className="text-xs font-semibold text-teal-accent">Workspace Modules</p>
            <h2 className="mt-1.5 font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
              Everything inside your chambers workspace
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <article className="neu-card rounded-3xl p-6 sm:p-7 flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-mono text-xs font-semibold text-teal-accent">
                    English &amp; हिंदी Assistant
                  </span>
                  <Languages className="w-5 h-5 text-teal-accent shrink-0" strokeWidth={2} />
                </div>
                <h3 className="mt-2.5 font-display text-lg font-semibold text-ink">
                  Bilingual Legal Research &amp; Drafting
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                  Ask questions in English, देवनागरी हिंदी, or Hinglish. Generates court affidavits directly into your active matter, maps IPC/CrPC/IEA sections, and pins Limitation deadlines.
                </p>
              </div>
              <p className="pt-3 border-t border-stone-hairline text-xs text-ink-muted">
                Auto-detects English, हिंदी &amp; Hinglish
              </p>
            </article>

            <article className="neu-card rounded-3xl p-6 sm:p-7 flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-mono text-xs font-semibold text-teal-accent">
                    Registry-Ready Court Forms
                  </span>
                  <FileDown className="w-5 h-5 text-teal-accent shrink-0" strokeWidth={2} />
                </div>
                <h3 className="mt-2.5 font-display text-lg font-semibold text-ink">
                  13 Judiciary Forms &amp; .DOCX Export
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                  Generate formatted pleadings with Cause Title, numbered paragraphs, Prayer, and Order XIX Rule 3 Verification—including Sec. 63 BSA Affidavits, 482 BNSS Bail, Writs, SLPs, and Vakalatnamas.
                </p>
              </div>
              <p className="pt-3 border-t border-stone-hairline text-xs text-ink-muted">
                Supreme Court · High Courts · District Courts · NCLT
              </p>
            </article>

            <article className="neu-card rounded-3xl p-6 sm:p-7 flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-mono text-xs font-semibold text-teal-accent">
                    Hearing &amp; Moot Rehearsal
                  </span>
                  <Gavel className="w-5 h-5 text-teal-accent shrink-0" strokeWidth={2} />
                </div>
                <h3 className="mt-2.5 font-display text-lg font-semibold text-ink">
                  Courtroom &amp; Moot Court Simulator
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                  Practice oral submissions before a simulated Bench or Opposing Counsel. Built for advocates preparing for final arguments and law students preparing for moot courts.
                </p>
              </div>
              <p className="pt-3 border-t border-stone-hairline text-xs text-ink-muted">
                Bench Questioning · Weakness Flags · Rebuttal Notes
              </p>
            </article>

            <article className="neu-card rounded-3xl p-6 sm:p-7 flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-mono text-xs font-semibold text-teal-accent">
                    OCR Vault, Redline &amp; Docket
                  </span>
                  <BookOpen className="w-5 h-5 text-teal-accent shrink-0" strokeWidth={2} />
                </div>
                <h3 className="mt-2.5 font-display text-lg font-semibold text-ink">
                  Document Vault, Contract Redline &amp; Limitation Tracker
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                  Extract text from scanned FIRs and orders, build chronological List of Dates tables, redline commercial contracts side by side, and monitor upcoming court hearings.
                </p>
              </div>
              <p className="pt-3 border-t border-stone-hairline text-xs text-ink-muted">
                OCR Extraction · Playbook Diffs · Cause List &amp; Deadlines
              </p>
            </article>
          </div>
        </section>
      </main>

      {/* Compact Footer */}
      <footer className="border-t border-stone-hairline bg-[#eae3d5] dark:bg-[#0e1415] text-ink-secondary">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-lg bg-[#0f5a5f] text-[#faf8f4] flex items-center justify-center">
              <Scale className="w-3.5 h-3.5" strokeWidth={2} />
            </span>
            <div>
              <span className="font-display text-sm font-bold text-ink">VidhiOS</span>
              <p className="text-[11px] text-ink-muted">
                © 2026 VidhiOS Legal Systems · Independent verification recommended before court filing.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-xs font-medium">
            <button
              type="button"
              onClick={() => scrollToAuth('login')}
              className="hover:text-teal-accent transition-colors"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => scrollToAuth('register')}
              className="hover:text-teal-accent transition-colors"
            >
              Create Account
            </button>
            <button
              type="button"
              onClick={handleDemoEntry}
              className="font-semibold text-teal-accent hover:underline"
            >
              Open Demo
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
