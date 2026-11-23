import React, { useMemo, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Briefcase,
  Check,
  CheckCircle2,
  FileDown,
  FileText,
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
  outcomeMetric: string;
  ctaLabel: string;
}

const DEFAULT_HERO_DRAFT =
  'Application u/s 438 CrPC seeking anticipatory bail in FIR alleging offences under Section 420 IPC and Section 406 IPC, supported by electronic records certified under Section 65B IEA.';

const AUDIENCE_ROLES: AudienceRole[] = [
  {
    id: 'judges',
    shortLabel: 'Judges & Practicing Judges',
    title: 'For Hon’ble Judges & Practicing Judges',
    subtitle: 'Bench Research · Record Verification · Contradiction Audit',
    image: '/src/assets/images/vidhios_bench_judiciary_1795319806872.jpg',
    imageAlt: 'Judicial chambers desk with scales of justice and neatly bound law reporters',
    summary:
      'Review lengthy case files, cross-check rival submissions against verified Supreme Court & High Court ratios, and flag factual contradictions across annexures—strictly grounded in the record before the Court.',
    benefits: [
      'Instant Chronology & List of Dates extracted from voluminous petitions and FIRs',
      'Cross-document contradiction scanner highlighting date, amount, or statement conflicts',
      'Verified Supreme Court & High Court precedent retrieval with zero fabricated citations',
      'Exact IPC, CrPC & Evidence Act to BNS, BNSS & BSA 2023 statutory comparison',
    ],
    outcomeMetric: 'Zero hallucinated case law — every citation verified against structured authorities',
    ctaLabel: 'Explore Judicial Workspace',
  },
  {
    id: 'advocates',
    shortLabel: 'Advocates & Lawyers',
    title: 'For Advocates, Senior Counsel & Practicing Lawyers',
    subtitle: 'Court Drafting · .DOCX Export · Case Tracker · Contract Redline',
    image: '/src/assets/images/vidhios_advocate_chambers_1795319807173.jpg',
    imageAlt: 'Senior advocate chambers table with ribbon-bound court briefs and fountain pen',
    summary:
      'Draft registry-ready affidavits, bail applications, writs, SLPs, and commercial redlines in minutes. Export clean Microsoft Word (.DOCX) filings, track hearings, and rehearse oral arguments before entering court.',
    benefits: [
      '13 Indian Judiciary Forms & Affidavits (482 BNSS, 63 BSA, SLP, Writ, Vakalatnama) with 1-click .DOCX export',
      'Live BNS / BNSS / BSA validator upgrades repealed IPC/CrPC/IEA sections across any pleading',
      'Deterministic Indian Limitation Act & Arbitration Sec. 34 calculator with Sunday roll-forward',
      'Playbook-driven contract redlining with side-by-side diffs and client-ready Hindi/English assistant',
    ],
    outcomeMetric: 'From raw client facts to court-formatted .DOCX filing in under 2 minutes',
    ctaLabel: 'Open Advocate Chambers',
  },
  {
    id: 'students',
    shortLabel: 'Law Students & Aspirants',
    title: 'For Law Students, Interns & Judicial Exam Aspirants',
    subtitle: 'BNS Mastery · Moot Court Prep · Hindi & English Learning',
    image: '/src/assets/images/vidhios_law_library_1795319806069.jpg',
    imageAlt: 'Sunlit modern law school library and moot court hall with students studying case reporters',
    summary:
      'Build real courtroom drafting and research skills before graduation. Practice moot court arguments against an interactive Bench, master the new criminal laws (BNS, BNSS, BSA), and study landmark judgments in English or हिंदी.',
    benefits: [
      'Interactive Moot Court & Courtroom Simulator that tests your submissions with real Bench questions',
      'Side-by-side IPC → BNS, CrPC → BNSS, and IEA → BSA 2023 reference ideal for PCS-J, AIBE & LL.B. exams',
      'Structured IRAC case briefs and verified Supreme Court ratio decidendi explained clearly',
      'Ask legal doubts and practice drafting pleadings in English, हिंदी (Hindi), or Hinglish',
    ],
    outcomeMetric: 'Hands-on mastery of real High Court & Supreme Court drafting standards',
    ctaLabel: 'Start Student & Moot Mode',
  },
];

const WORKFLOW_STEPS = [
  {
    step: 1,
    short: 'Pick Your Case or Topic',
    label: 'Start With a Matter, Brief, or Research Question',
    badge: 'Clear Context',
    summary:
      'Open an existing litigation file, upload a scanned order or FIR, or start a fresh legal research note. Every tool in VidhiOS automatically understands your active case facts and court forum.',
    deliverable: 'Organized Matter Dossier for Litigation, Judicial Review, Corporate, or Study',
  },
  {
    step: 2,
    short: 'Verify Law & Citations',
    label: 'Check BNS / BNSS / BSA & Verified Case Law',
    badge: 'Zero Hallucination',
    summary:
      'Scan any draft to replace repealed IPC, CrPC, and Evidence Act sections automatically. Search verified Supreme Court and High Court authorities without worrying about invented citations.',
    deliverable: '100% Updated BNS/BNSS/BSA Text + Source-Backed IRAC Research',
  },
  {
    step: 3,
    short: 'Draft, Redline or Practice',
    label: 'Generate Affidavits, Redlines, or Rehearse Arguments',
    badge: 'English & हिंदी',
    summary:
      'Generate court-formatted affidavits, bail petitions, and notices in English or Hindi, redline commercial contracts side by side, or practice answering tough Bench questions in the Courtroom Simulator.',
    deliverable: 'Court-Ready Pleadings, Redlined Contracts & Oral Rebuttal Notes',
  },
  {
    step: 4,
    short: 'Download .DOCX & Track',
    label: 'Export Word Files & Never Miss a Filing Deadline',
    badge: 'Ready for Court',
    summary:
      'Download properly structured Microsoft Word (.DOCX) filings with Cause Title and Verification, calculate exact Limitation Act expiry dates, and track upcoming hearings in one calm workspace.',
    deliverable: 'Court-Formatted .DOCX Filings + Verified Limitation & Hearing Calendar',
  },
];

export function AuthGate({ onAuthenticated }: AuthGateProps) {
  // Mobile nav menu toggle (compact, clean)
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Audience Role Showcase State
  const [selectedRole, setSelectedRole] = useState<AudienceRoleId>('judges');

  // Interactive Hero Sandbox State (real deterministic engines)
  const [heroTab, setHeroTab] = useState<HeroSandboxTab>('bns');
  const [heroDraft, setHeroDraft] = useState<string>(DEFAULT_HERO_DRAFT);
  const [heroRuleId, setHeroRuleId] = useState<string>(LIMITATION_RULES[0].id);
  const [heroTriggerDate, setHeroTriggerDate] = useState<string>(
    new Date(Date.now() - 18 * 86400000).toISOString().slice(0, 10)
  );
  const [heroRedlineDecision, setHeroRedlineDecision] = useState<'pending' | 'accepted' | 'rejected'>('pending');

  // Workflow Stepper State
  const [activeStep, setActiveStep] = useState<number>(1);

  // Chambers Sign-In / Register State
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [organization, setOrganization] = useState('');
  const [defaultJurisdiction, setDefaultJurisdiction] =
    useState<JurisdictionMode>('india_litigation');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authSectionRef = useRef<HTMLElement | null>(null);
  const audiencesSectionRef = useRef<HTMLElement | null>(null);
  const heroStageRef = useRef<HTMLDivElement | null>(null);
  const audienceCardRef = useRef<HTMLDivElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  const prefersReducedMotion = useReducedMotion();

  // Global scroll progress indicator for the floating home bar
  const { scrollYProgress } = useScroll();
  const smoothScrollProgress = useSpring(scrollYProgress, {
    stiffness: 180,
    damping: 32,
    restDelta: 0.001,
  });

  // Hero scroll-linked image zoom & depth parallax (compositor-only: transform & opacity)
  const { scrollYProgress: heroScrollProgress } = useScroll({
    target: heroStageRef,
    offset: ['start start', 'end start'],
  });
  const smoothHeroProgress = useSpring(heroScrollProgress, {
    stiffness: 140,
    damping: 26,
    mass: 0.25,
  });
  const heroImgY = useTransform(smoothHeroProgress, [0, 1], [0, 84]);
  const heroImgScale = useTransform(smoothHeroProgress, [0, 1], [1.02, 1.14]);
  const heroTextY = useTransform(smoothHeroProgress, [0, 1], [0, -32]);
  const heroTextOpacity = useTransform(smoothHeroProgress, [0, 0.85], [1, 0.65]);

  // Audience editorial photo subtle scroll-linked glide
  const { scrollYProgress: audienceScrollProgress } = useScroll({
    target: audienceCardRef,
    offset: ['start end', 'end start'],
  });
  const audienceImgY = useTransform(audienceScrollProgress, [0, 1], [-20, 20]);

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
    authSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => emailInputRef.current?.focus(), 420);
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
      setAuthToken(res.token);
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
      setAuthToken(res.token);
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open demo workspace.');
    } finally {
      setSubmitting(false);
    }
  };

  const currentRole = AUDIENCE_ROLES.find((r) => r.id === selectedRole) ?? AUDIENCE_ROLES[0];
  const currentStepData = WORKFLOW_STEPS[activeStep - 1] ?? WORKFLOW_STEPS[0];

  return (
    <div className="min-h-screen neu-canvas flex flex-col">
      {/* Architectural 3-Zone Top Navigation Bar (Strict Contract: Brand · 5 Single-Line Links · 1 Primary CTA) */}
      <header className="sticky top-0 z-40 px-4 sm:px-6 pt-2.5 pb-2 bg-[#efeae0]/88 dark:bg-[#121819]/88 backdrop-blur-md">
        <div className="relative overflow-hidden max-w-[1240px] mx-auto rounded-2xl bg-[#faf7f0]/95 dark:bg-[#192224]/95 border border-[#ddd5c5] dark:border-[#263336] shadow-sm px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
          {/* Subtle GPU-composited scroll progress hairline */}
          {!prefersReducedMotion && (
            <motion.div
              aria-hidden="true"
              style={{ scaleX: smoothScrollProgress }}
              className="absolute bottom-0 left-0 right-0 h-[2px] origin-left bg-[#0f5a5f] dark:bg-[#57c5cc] pointer-events-none"
            />
          )}
          {/* Zone 1: Clean single-line brand wordmark */}
          <a
            href="#top"
            className="inline-flex items-center gap-2.5 font-display text-lg font-bold tracking-tight text-ink whitespace-nowrap shrink-0"
          >
            <span className="w-8 h-8 rounded-xl bg-[#0f5a5f] dark:bg-[#14777e] text-[#faf8f4] flex items-center justify-center shadow-xs shrink-0">
              <Scale className="w-4 h-4" strokeWidth={2} />
            </span>
            <span>VidhiOS</span>
          </a>

          {/* Zone 2: 5 crisp single-line navigation links */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-ink-secondary"
          >
            <a
              href="#audiences"
              className="relative py-1 hover:text-ink transition-colors whitespace-nowrap shrink-0 after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[2px] after:w-0 after:bg-[#0f5a5f] dark:after:bg-[#57c5cc] hover:after:w-full after:transition-all"
            >
              Who It’s For
            </a>
            <a
              href="#live-tools"
              className="relative py-1 hover:text-ink transition-colors whitespace-nowrap shrink-0 after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[2px] after:w-0 after:bg-[#0f5a5f] dark:after:bg-[#57c5cc] hover:after:w-full after:transition-all"
            >
              Live Tools
            </a>
            <a
              href="#bilingual-ai"
              className="relative py-1 hover:text-ink transition-colors whitespace-nowrap shrink-0 after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[2px] after:w-0 after:bg-[#0f5a5f] dark:after:bg-[#57c5cc] hover:after:w-full after:transition-all"
            >
              Hindi &amp; English AI
            </a>
            <a
              href="#how-it-works"
              className="relative py-1 hover:text-ink transition-colors whitespace-nowrap shrink-0 after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[2px] after:w-0 after:bg-[#0f5a5f] dark:after:bg-[#57c5cc] hover:after:w-full after:transition-all"
            >
              How It Works
            </a>
            <a
              href="#chambers-access"
              className="relative py-1 hover:text-ink transition-colors whitespace-nowrap shrink-0 after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[2px] after:w-0 after:bg-[#0f5a5f] dark:after:bg-[#57c5cc] hover:after:w-full after:transition-all"
            >
              Sign In
            </a>
          </nav>

          {/* Zone 3: 1 Primary CTA (+ compact mobile nav drawer toggle on <md) */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDemoEntry}
              disabled={submitting}
              className="neu-btn-primary px-4 sm:px-5 py-2 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              {submitting ? 'Opening...' : 'Open Workspace'}
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

        {/* Clean Mobile Navigation Drawer */}
        {mobileNavOpen && (
          <nav
            aria-label="Mobile navigation"
            className="md:hidden mt-2 max-w-[1240px] mx-auto rounded-2xl bg-[#faf7f0] dark:bg-[#192224] border border-[#ddd5c5] dark:border-[#263336] shadow-md p-3 flex flex-col gap-1 text-sm font-medium text-ink-secondary"
          >
            <a
              href="#audiences"
              onClick={() => setMobileNavOpen(false)}
              className="px-3 py-2.5 rounded-xl hover:bg-[#efe9dc] dark:hover:bg-[#151d1f] hover:text-ink"
            >
              Who It’s For (Judges, Lawyers &amp; Students)
            </a>
            <a
              href="#live-tools"
              onClick={() => setMobileNavOpen(false)}
              className="px-3 py-2.5 rounded-xl hover:bg-[#efe9dc] dark:hover:bg-[#151d1f] hover:text-ink"
            >
              Try Live Legal Tools
            </a>
            <a
              href="#bilingual-ai"
              onClick={() => setMobileNavOpen(false)}
              className="px-3 py-2.5 rounded-xl hover:bg-[#efe9dc] dark:hover:bg-[#151d1f] hover:text-ink"
            >
              Hindi &amp; English AI Assistant
            </a>
            <a
              href="#how-it-works"
              onClick={() => setMobileNavOpen(false)}
              className="px-3 py-2.5 rounded-xl hover:bg-[#efe9dc] dark:hover:bg-[#151d1f] hover:text-ink"
            >
              How It Works
            </a>
            <a
              href="#chambers-access"
              onClick={() => setMobileNavOpen(false)}
              className="px-3 py-2.5 rounded-xl hover:bg-[#efe9dc] dark:hover:bg-[#151d1f] hover:text-ink"
            >
              Sign In / Create Account
            </a>
          </nav>
        )}
      </header>

      <main id="top" className="flex-1">
        {/* SECTION 1: Centered Cinematic Architectural Hero Centerpiece with Scroll-Linked Image Parallax */}
        <section className="max-w-[1240px] mx-auto px-4 sm:px-6 pt-5 pb-12 lg:pt-7 lg:pb-16">
          <div
            ref={heroStageRef}
            className="relative rounded-[28px] overflow-hidden border border-[#d6cdbc] dark:border-[#263336] shadow-[0_24px_56px_rgba(18,24,25,0.20)] bg-[#142022] min-h-[560px] lg:min-h-[630px] flex flex-col justify-between"
          >
            {/* Scroll-Animated Full-Bleed Architectural Courtroom Image */}
            <motion.div
              aria-hidden="true"
              data-hero-parallax="image"
              style={
                prefersReducedMotion
                  ? undefined
                  : { y: heroImgY, scale: heroImgScale }
              }
              className="absolute inset-0 will-change-transform"
            >
              <motion.img
                src="/src/assets/images/vidhios_hero_centerpiece_1795330712517.jpg"
                alt="Sunlit Indian High Court and Supreme Court hall with sandstone arches, Hon'ble Bench, leather-bound law reporters, and gleaming brass scales of justice"
                referrerPolicy="no-referrer"
                initial={prefersReducedMotion ? false : { opacity: 0.72, scale: 1.07 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
                className="w-full h-full object-cover object-center will-change-transform"
              />
            </motion.div>

            {/* Balanced Radial + Vignette Editorial Scrim for Centered Copy Legibility */}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(10,20,22,0.78)_0%,rgba(10,20,22,0.56)_58%,rgba(10,20,22,0.74)_100%)]"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-b from-[#0b1517]/40 via-transparent to-[#0b1517]/75"
            />

            {/* Completely Centered Hero Foreground Copy & Primary Actions */}
            <motion.div
              data-hero-parallax="copy"
              style={
                prefersReducedMotion
                  ? undefined
                  : { y: heroTextY, opacity: heroTextOpacity }
              }
              className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-5 sm:px-10 lg:px-14 pt-12 sm:pt-16 pb-10 max-w-4xl mx-auto will-change-transform"
            >
              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0.85, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center justify-center text-center"
              >
              <p className="text-xs sm:text-[13px] font-semibold text-[#9be2e7] tracking-normal">
                Built for Judges · Practicing Judges · Advocates · Lawyers · Law Students
              </p>

              <h1 className="mt-4 font-display font-bold tracking-tight text-[#faf8f4] leading-[1.06] text-[clamp(2.1rem,4.3vw,3.75rem)]">
                Verified legal intelligence for the Bench, the Bar, and Law Students.
              </h1>

              <p className="mt-5 text-sm sm:text-base leading-relaxed text-[#ece8df] max-w-2xl mx-auto">
                Research verified Supreme Court &amp; High Court judgments, draft court-ready affidavits and <strong className="text-[#faf8f4]">.DOCX</strong> pleadings, convert IPC/CrPC/IEA sections to BNS/BNSS/BSA, and work in <strong className="text-[#faf8f4]">English or हिंदी</strong> — with zero hallucination.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
                <button
                  type="button"
                  onClick={handleDemoEntry}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 sm:px-6 py-3 sm:py-3.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap bg-[#14777e] hover:bg-[#198c94] text-[#faf8f4] shadow-lg transition-all disabled:opacity-50"
                >
                  <span>Open Demo Chambers Workspace</span>
                  <ArrowRight className="w-4 h-4 shrink-0" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={() => scrollToAuth('login')}
                  className="inline-flex items-center gap-2 px-5 py-3 sm:py-3.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap bg-[#faf8f4]/14 hover:bg-[#faf8f4]/24 text-[#faf8f4] border border-[#faf8f4]/35 backdrop-blur-sm transition-all"
                >
                  Sign In / Create Account
                </button>
              </div>
              </motion.div>
            </motion.div>

            {/* Centered Integrated Bottom Role Quick-Jump Dock */}
            <div className="relative z-10 px-5 sm:px-10 py-4 border-t border-[#faf8f4]/18 bg-[#0b1517]/70 backdrop-blur-md flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => focusAudienceRole('judges')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#faf8f4] bg-[#faf8f4]/10 hover:bg-[#14777e] border border-[#faf8f4]/20 transition-colors whitespace-nowrap"
              >
                <Gavel className="w-3.5 h-3.5 text-[#9be2e7]" strokeWidth={2} />
                <span>Judges &amp; Practicing Judges</span>
              </button>
              <button
                type="button"
                onClick={() => focusAudienceRole('advocates')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#faf8f4] bg-[#faf8f4]/10 hover:bg-[#14777e] border border-[#faf8f4]/20 transition-colors whitespace-nowrap"
              >
                <Briefcase className="w-3.5 h-3.5 text-[#9be2e7]" strokeWidth={2} />
                <span>Advocates &amp; Lawyers</span>
              </button>
              <button
                type="button"
                onClick={() => focusAudienceRole('students')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#faf8f4] bg-[#faf8f4]/10 hover:bg-[#14777e] border border-[#faf8f4]/20 transition-colors whitespace-nowrap"
              >
                <GraduationCap className="w-3.5 h-3.5 text-[#9be2e7]" strokeWidth={2} />
                <span>Law Students &amp; Aspirants</span>
              </button>
              <a
                href="#live-tools"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#9be2e7] hover:text-[#faf8f4] transition-colors whitespace-nowrap shrink-0"
              >
                <span>Try Live Legal Engines</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Full-Width 4-Column Quantitative Proof Strip Below Hero Centerpiece */}
          <div className="mt-9 pt-7 border-t border-stone-hairline grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            <div>
              <p className="font-mono text-2xl sm:text-3xl font-semibold tabular-nums text-teal-accent">
                13
              </p>
              <p className="mt-1 text-xs sm:text-sm font-medium text-ink">
                Court Judiciary Forms
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                Affidavits, Bail, SLP, Writs &amp; Vakalatnama in .DOCX
              </p>
            </div>
            <div>
              <p className="font-mono text-2xl sm:text-3xl font-semibold tabular-nums text-teal-accent">
                52+
              </p>
              <p className="mt-1 text-xs sm:text-sm font-medium text-ink">
                Verified Statute Mappings
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                Exact IPC → BNS, CrPC → BNSS &amp; IEA → BSA table
              </p>
            </div>
            <div>
              <p className="font-mono text-2xl sm:text-3xl font-semibold tabular-nums text-teal-accent">
                EN + हिंदी
              </p>
              <p className="mt-1 text-xs sm:text-sm font-medium text-ink">
                Bilingual Legal Assistant
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                Ask questions &amp; draft documents in Hindi or English
              </p>
            </div>
            <div>
              <p className="font-mono text-2xl sm:text-3xl font-semibold tabular-nums text-teal-accent">
                0%
              </p>
              <p className="mt-1 text-xs sm:text-sm font-medium text-ink">
                Invented Case Citations
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                Deterministic engines + verified SC/HC precedent corpus
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 1B: Dedicated Live Interactive Legal Sandbox (#live-tools) */}
        <section id="live-tools" className="scroll-mt-24 max-w-[1240px] mx-auto px-4 sm:px-6 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            <div className="lg:col-span-5 flex flex-col justify-between py-1">
              <div>
                <p className="text-xs font-semibold text-teal-accent">
                  Interactive Legal Sandbox
                </p>
                <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink leading-tight">
                  Test real legal engines right here — before signing in
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
                  Try the exact deterministic tools used inside VidhiOS chambers. Edit a pleading to see instant IPC → BNS / BNSS / BSA upgrades, calculate Limitation Act filing deadlines, or review a fair commercial redline.
                </p>

                <div className="mt-6 space-y-2.5 border-t border-stone-hairline pt-5 text-xs text-ink-secondary">
                  <p>
                    <strong className="text-ink">1. BNS / BNSS / BSA Audit:</strong> Instantly spots repealed IPC, CrPC &amp; Evidence Act citations and updates them accurately.
                  </p>
                  <p>
                    <strong className="text-ink">2. Limitation Calculator:</strong> Computes statutory deadlines, Sunday roll-forwards (Sec. 4), and Arbitration Sec. 34 outer caps.
                  </p>
                  <p>
                    <strong className="text-ink">3. Contract Clause Redline:</strong> Compares risky counterparty clauses against fair Sec. 73 Indian Contract Act fallbacks.
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-stone-hairline">
                <button
                  type="button"
                  onClick={handleDemoEntry}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-accent hover:underline whitespace-nowrap"
                >
                  <span>Open all 9 modules in Demo Chambers</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="neu-card rounded-3xl p-5 sm:p-7 h-full flex flex-col justify-between">
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-hairline">
                    <div>
                      <p className="font-mono text-[11px] font-semibold text-teal-accent">
                        Live Deterministic Preview
                      </p>
                      <h3 className="font-display text-base font-semibold text-ink mt-0.5">
                        Try Core Legal Engines Instantly
                      </h3>
                    </div>

                    <div
                      role="tablist"
                      aria-label="Interactive hero tools"
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

                  {/* TAB 1: Live BNS / BNSS / BSA Draft Scanner */}
                  {heroTab === 'bns' && (
                    <div className="mt-5 space-y-4">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <label htmlFor="hero-bns-editor" className="text-xs font-medium text-ink-secondary">
                            Paste or Edit Any Pleading Excerpt (Scans Live)
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
                          rows={4}
                          value={heroDraft}
                          onChange={(e) => setHeroDraft(e.target.value)}
                          className="neu-input w-full p-3.5 text-xs sm:text-sm leading-relaxed rounded-2xl resize-none"
                        />
                      </div>

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
                              Every repealed citation is updated accurately with its corresponding legacy reference in brackets.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: Live Indian Limitation Act Calculator */}
                  {heroTab === 'limitation' && (
                    <div className="mt-5 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="hero-lim-rule" className="block text-xs font-medium text-ink-secondary mb-1">
                            Legal Remedy / Petition Type
                          </label>
                          <select
                            id="hero-lim-rule"
                            value={heroRuleId}
                            onChange={(e) => setHeroRuleId(e.target.value)}
                            className="neu-input w-full px-3.5 py-2 text-xs rounded-xl"
                          >
                            {LIMITATION_RULES.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="hero-lim-date" className="block text-xs font-medium text-ink-secondary mb-1">
                            Order / Award Receipt Date
                          </label>
                          <input
                            id="hero-lim-date"
                            type="date"
                            value={heroTriggerDate}
                            onChange={(e) => setHeroTriggerDate(e.target.value)}
                            className="neu-input w-full px-3.5 py-2 text-xs font-mono rounded-xl"
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

                  {/* TAB 3: Interactive Clause Redline Decision Preview */}
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

                <div className="mt-5 pt-4 border-t border-stone-hairline flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-ink-muted">
                    Inside workspace: Hindi/English AI, 13 Court Forms (.DOCX), OCR &amp; Moot/Bench Simulator.
                  </p>
                  <button
                    type="button"
                    onClick={handleDemoEntry}
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-accent hover:underline whitespace-nowrap shrink-0"
                  >
                    <span>Open Full Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: Dedicated Audience Spotlight (Judges, Practicing Judges, Advocates, Lawyers & Law Students) */}
        <section
          id="audiences"
          ref={audiencesSectionRef}
          className="scroll-mt-20 border-y border-stone-hairline bg-[#f3eee4]/75 dark:bg-[#161e20]/75 py-16 lg:py-20"
        >
          <div className="max-w-[1240px] mx-auto px-4 sm:px-6">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold text-teal-accent">
                  Purpose-Built for the Entire Legal Community
                </p>
                <h2 className="mt-2 font-display text-2xl sm:text-3xl lg:text-[2.15rem] font-bold tracking-tight text-ink leading-tight">
                  Tailored for Judges, Practicing Judges, Advocates, Lawyers &amp; Law Students
                </h2>
              </div>

              {/* Clean Segmented Role Selector */}
              <div
                role="tablist"
                aria-label="Select legal audience role"
                className="neu-tab-bar rounded-2xl p-1.5 flex flex-wrap sm:flex-nowrap items-center gap-1 shrink-0"
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

            {/* Active Role Editorial Feature Card with Scroll-Triggered Image Reveal & Parallax */}
            <motion.div
              ref={audienceCardRef}
              initial={prefersReducedMotion ? false : { opacity: 0.7, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
              className="mt-8 neu-card rounded-3xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch"
            >
              <div className="lg:col-span-6 relative min-h-[260px] sm:min-h-[360px] bg-[#dfd7c8] dark:bg-[#1d292c] overflow-hidden">
                <motion.div
                  data-audience-parallax="image"
                  style={prefersReducedMotion ? undefined : { y: audienceImgY }}
                  className="absolute inset-0 will-change-transform"
                >
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={currentRole.id}
                      src={currentRole.image}
                      alt={currentRole.imageAlt}
                      referrerPolicy="no-referrer"
                      initial={prefersReducedMotion ? false : { opacity: 0.35, scale: 1.09 }}
                      animate={{ opacity: 1, scale: 1.05 }}
                      exit={prefersReducedMotion ? undefined : { opacity: 0.3, scale: 1.02 }}
                      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                      className="w-full h-full object-cover will-change-transform"
                    />
                  </AnimatePresence>
                </motion.div>
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-[#121819]/78 via-[#121819]/18 to-transparent pointer-events-none"
                />
                <div className="absolute bottom-5 left-5 right-5 text-[#faf8f4] z-10">
                  <p className="text-xs font-mono text-[#d8ecee]">{currentRole.subtitle}</p>
                  <p className="mt-1 font-display text-lg font-semibold leading-snug">
                    {currentRole.outcomeMetric}
                  </p>
                </div>
              </div>

              <div className="lg:col-span-6 p-6 sm:p-8 lg:p-10 flex flex-col justify-between">
                <div>
                  <p className="font-mono text-xs font-semibold text-teal-accent">
                    {currentRole.shortLabel}
                  </p>
                  <h3 className="mt-2 font-display text-xl sm:text-2xl font-bold text-ink">
                    {currentRole.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
                    {currentRole.summary}
                  </p>

                  <ul className="mt-6 space-y-3 border-t border-stone-hairline pt-5">
                    {currentRole.benefits.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm text-ink">
                        <CheckCircle2
                          className="w-4 h-4 text-teal-accent shrink-0 mt-0.5"
                          strokeWidth={2}
                        />
                        <span className="leading-snug text-ink-secondary">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 pt-5 border-t border-stone-hairline flex flex-wrap items-center justify-between gap-4">
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
                    Create Free Account →
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Quiet 3-Card Role Overview Strip Below (Click any card to switch spotlight) */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-5">
              {AUDIENCE_ROLES.map((role, idx) => {
                const isSelected = role.id === selectedRole;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedRole(role.id)}
                    className={`text-left rounded-2xl p-5 transition-all border ${
                      isSelected
                        ? 'bg-[#faf7f0] dark:bg-[#1f2a2d] border-[#0f5a5f] dark:border-[#57c5cc] shadow-sm'
                        : 'bg-[#f7f3eb]/70 dark:bg-[#192224]/70 border-[#ddd5c5] dark:border-[#263336] hover:border-[#0f5a5f]/60'
                    }`}
                  >
                    <p className="font-mono text-xs font-semibold text-teal-accent">
                      0{idx + 1}. {role.shortLabel}
                    </p>
                    <p className="mt-1.5 text-sm font-semibold text-ink">{role.subtitle}</p>
                    <p className="mt-1.5 text-xs text-ink-secondary leading-relaxed line-clamp-2">
                      {role.summary}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* SECTION 3: Bilingual Hindi/English Zero-Hallucination AI & Core Capabilities Bento */}
        <section id="bilingual-ai" className="scroll-mt-20 max-w-[1240px] mx-auto px-4 sm:px-6 py-16 lg:py-20">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold text-teal-accent">
                Simple, Reliable Legal Modules
              </p>
              <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                Everything you need to read, draft, verify, and argue with confidence
              </h2>
            </div>
            <p className="text-sm text-ink-secondary max-w-sm leading-relaxed">
              No complex setup. Every module speaks plain English and हिंदी and saves directly to your case folder.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* 01. Marquee 7-Col: Hindi & English Zero-Hallucination Legal Assistant */}
            <article className="lg:col-span-7 neu-card rounded-3xl p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-mono text-xs font-semibold text-teal-accent">
                    01. English &amp; हिंदी Legal Assistant
                  </span>
                  <Languages className="w-5 h-5 text-teal-accent shrink-0" strokeWidth={2} />
                </div>
                <h3 className="mt-3 font-display text-xl sm:text-2xl font-semibold text-ink">
                  Complete real legal tasks in Hindi or English — without AI hallucination
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-ink-secondary">
                  Ask in English, देवनागरी हिंदी, or Hinglish. Instead of guessing, VidhiOS runs verified statutory tools first: it drafts court affidavits directly into your case, gives instant Word (.DOCX) downloads, maps IPC/CrPC/IEA sections, and pins Limitation deadlines.
                </p>

                {/* Crisp Concrete Bilingual Exchange Sample */}
                <div className="mt-5 neu-inset rounded-2xl p-4 space-y-3 text-xs">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-ink">
                      “धारा 420 IPC और 438 CrPC के नए सेक्शन बताओ और Section 63 BSA एफिडेविट बनाओ”
                    </p>
                    <span className="font-mono text-[11px] text-ink-muted shrink-0">हिंदी</span>
                  </div>
                  <div className="pt-2.5 border-t border-stone-hairline text-ink-secondary leading-relaxed">
                    <span className="font-semibold text-[#115442] dark:text-emerald-300">
                      Verified Engine Output:
                    </span>{' '}
                    IPC 420 → <strong>BNS 318(4)</strong> · CrPC 438 → <strong>BNSS 482</strong> · Court-ready Section 63 BSA Affidavit saved to Matter Drafts with instant <strong>.DOCX</strong> download.
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-stone-hairline flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-ink-muted">
                  Auto-detects English, हिंदी &amp; Hinglish · Explicit [Verification Required] safeguard
                </span>
                <button
                  type="button"
                  onClick={handleDemoEntry}
                  className="font-semibold text-teal-accent hover:underline whitespace-nowrap"
                >
                  Try Hindi/English Assistant →
                </button>
              </div>
            </article>

            {/* 02. 5-Col: 13 Indian Judiciary Forms & Instant .DOCX */}
            <article className="lg:col-span-5 neu-card rounded-3xl p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-mono text-xs font-semibold text-teal-accent">
                    02. Registry-Ready Court Forms
                  </span>
                  <FileDown className="w-5 h-5 text-teal-accent shrink-0" strokeWidth={2} />
                </div>
                <h3 className="mt-3 font-display text-xl font-semibold text-ink">
                  13 Court Forms &amp; Affidavits with 1-Click .DOCX Export
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-ink-secondary">
                  Generate formatted pleadings with Cause Title, numbered paragraphs, Prayer, and Order XIX Rule 3 Verification—ready to print or file in Supreme Court, High Courts, and District Courts.
                </p>

                <ul className="mt-5 pt-4 border-t border-stone-hairline grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-ink-secondary">
                  <li>· Section 63 BSA Affidavit</li>
                  <li>· Anticipatory Bail (482 BNSS)</li>
                  <li>· Vakalatnama &amp; Caveat</li>
                  <li>· SLP (Art. 136) &amp; Writ (226)</li>
                  <li>· Counter &amp; Rejoinder Affidavit</li>
                  <li>· Sec. 138 NI Demand Notice</li>
                </ul>
              </div>
              <p className="mt-6 pt-4 border-t border-stone-hairline text-xs text-ink-muted">
                Supreme Court · High Courts · District &amp; Sessions Courts · NCLT
              </p>
            </article>

            {/* 03. 5-Col: Courtroom & Moot Court Simulator */}
            <article className="lg:col-span-5 neu-card rounded-3xl p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-mono text-xs font-semibold text-teal-accent">
                    03. Hearing &amp; Moot Rehearsal
                  </span>
                  <Gavel className="w-5 h-5 text-teal-accent shrink-0" strokeWidth={2} />
                </div>
                <h3 className="mt-3 font-display text-xl font-semibold text-ink">
                  Courtroom &amp; Moot Court Simulator
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-ink-secondary">
                  Stress-test oral arguments before a probing Hon’ble Bench or tough Opposing Counsel. Built for advocates preparing for final arguments and law students preparing for national moot court competitions.
                </p>
              </div>
              <p className="mt-6 pt-4 border-t border-stone-hairline text-xs text-ink-muted">
                Bench Questioning · Weak-Point Detection · Precedent-Backed Rebuttals
              </p>
            </article>

            {/* 04. 7-Col: Verified Research, OCR Vault & Case Tracker */}
            <article className="lg:col-span-7 neu-card rounded-3xl p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-mono text-xs font-semibold text-teal-accent">
                    04. Research, OCR Vault &amp; Case Operations
                  </span>
                  <BookOpen className="w-5 h-5 text-teal-accent shrink-0" strokeWidth={2} />
                </div>
                <h3 className="mt-3 font-display text-xl font-semibold text-ink">
                  Verified Case Analysis, Scanned Document OCR &amp; Limitation Tracker
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-ink-secondary">
                  Upload scanned FIRs, orders, or contracts to extract clean text, build chronological List of Dates tables, catch contradictions across documents, translate into 8+ Indian languages, and monitor upcoming hearings and statutory deadlines.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-stone-hairline grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="font-semibold text-ink block">Document Vault</span>
                  <span className="text-ink-muted">OCR, List of Dates &amp; Translation</span>
                </div>
                <div>
                  <span className="font-semibold text-ink block">Contract Redline</span>
                  <span className="text-ink-muted">Side-by-side diffs &amp; DD Matrix</span>
                </div>
                <div>
                  <span className="font-semibold text-ink block">Case Tracker &amp; Limitation</span>
                  <span className="text-ink-muted">Cause lists, statutory dates &amp; reminders</span>
                </div>
              </div>
            </article>
          </div>
        </section>

        {/* SECTION 4: Simple 4-Step Interactive Process (#how-it-works) */}
        <section
          id="how-it-works"
          className="scroll-mt-20 border-y border-stone-hairline bg-[#f3eee4]/75 dark:bg-[#161e20]/75 py-16"
        >
          <div className="max-w-[1240px] mx-auto px-4 sm:px-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold text-teal-accent">Easy to Understand Workflow</p>
                <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                  From raw case facts to court-ready files in four clear steps
                </h2>
              </div>
              <p className="text-xs text-ink-muted max-w-xs">
                Click any step below to see what you get at each stage.
              </p>
            </div>

            <div className="mt-9 neu-card rounded-3xl p-6 sm:p-8">
              <div className="relative grid grid-cols-2 md:grid-cols-4 gap-4 items-start">
                <div
                  aria-hidden="true"
                  className="hidden md:block absolute top-5 left-[12.5%] right-[12.5%] h-[2px] bg-[#d6cdbc] dark:bg-[#2a383c]"
                />
                <div
                  aria-hidden="true"
                  className="hidden md:block absolute top-5 left-[12.5%] h-[2px] bg-[#0f5a5f] dark:bg-[#57c5cc] transition-all duration-300"
                  style={{ width: `${((activeStep - 1) / 3) * 75}%` }}
                />

                {WORKFLOW_STEPS.map((item) => {
                  const isActive = item.step === activeStep;
                  const isCompleted = item.step < activeStep;
                  return (
                    <button
                      key={item.step}
                      type="button"
                      onClick={() => setActiveStep(item.step)}
                      className="relative z-10 flex flex-col items-center text-center group focus:outline-none"
                    >
                      <span
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-mono text-sm font-semibold tabular-nums transition-all ${
                          isActive
                            ? 'bg-[#0f5a5f] text-[#faf8f4] shadow-md ring-4 ring-[#0f5a5f]/15 dark:bg-[#14777e]'
                            : isCompleted
                              ? 'bg-[#f7f3eb] dark:bg-[#192224] text-teal-accent border-2 border-[#0f5a5f] dark:border-[#57c5cc]'
                              : 'bg-[#f7f3eb] dark:bg-[#192224] text-ink-muted border-2 border-[#cfc5b2] dark:border-[#324347] group-hover:border-[#0f5a5f]'
                        }`}
                      >
                        {isCompleted ? <Check className="w-4 h-4" strokeWidth={2.5} /> : item.step}
                      </span>
                      <span
                        className={`mt-3 text-xs font-semibold transition-colors ${
                          isActive ? 'text-teal-accent' : 'text-ink-secondary group-hover:text-ink'
                        }`}
                      >
                        {item.step}. {item.short}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 pt-6 border-t border-stone-hairline grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                <div className="lg:col-span-8">
                  <p className="font-mono text-xs text-teal-accent font-medium">
                    Step 0{currentStepData.step} · {currentStepData.badge}
                  </p>
                  <h3 className="mt-1.5 font-display text-xl font-semibold text-ink">
                    {currentStepData.label}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                    {currentStepData.summary}
                  </p>
                </div>
                <div className="lg:col-span-4 neu-inset rounded-2xl p-5 flex flex-col justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-mono text-ink-muted">What You Get</p>
                    <p className="mt-1 text-sm font-semibold text-ink leading-snug">
                      {currentStepData.deliverable}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDemoEntry}
                    className="neu-btn-primary px-4 py-2 rounded-full text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <span>Try This in Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 5: Account Access & Privacy Assurance (#chambers-access) */}
        <section
          id="chambers-access"
          ref={authSectionRef}
          className="scroll-mt-20 py-16 lg:py-20"
        >
          <div className="max-w-[1240px] mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-between py-2">
              <div>
                <p className="text-xs font-semibold text-teal-accent">
                  Private &amp; Reliable Legal Workspace
                </p>
                <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                  Built for judicial neutrality, client confidentiality, and academic rigor
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
                  Whether you are a Judge reviewing petitions, an Advocate managing live dockets, or a Law Student preparing for Moot Court and PCS-J, your matters, drafts, and notes stay isolated to your private account.
                </p>

                <dl className="mt-8 space-y-5 border-t border-stone-hairline pt-6">
                  <div className="flex items-start gap-3.5">
                    <span className="w-9 h-9 rounded-xl neu-inset flex items-center justify-center shrink-0 text-teal-accent">
                      <ShieldCheck className="w-4 h-4" strokeWidth={2} />
                    </span>
                    <div>
                      <dt className="font-display text-sm font-semibold text-ink">
                        Private Per-User Isolation
                      </dt>
                      <dd className="text-xs text-ink-secondary mt-0.5 leading-relaxed">
                        Every case dossier, draft, uploaded document, and bilingual chat thread is strictly scoped to your authenticated session.
                      </dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-3.5">
                    <span className="w-9 h-9 rounded-xl neu-inset flex items-center justify-center shrink-0 text-teal-accent">
                      <FileText className="w-4 h-4" strokeWidth={2} />
                    </span>
                    <div>
                      <dt className="font-display text-sm font-semibold text-ink">
                        Verified Statutory Math — Not Guesswork
                      </dt>
                      <dd className="text-xs text-ink-secondary mt-0.5 leading-relaxed">
                        IPC/CrPC/IEA → BNS/BNSS/BSA mappings and Indian Limitation Act dates are computed by deterministic verified engines with zero fabrication.
                      </dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-3.5">
                    <span className="w-9 h-9 rounded-xl neu-inset flex items-center justify-center shrink-0 text-teal-accent">
                      <Scale className="w-4 h-4" strokeWidth={2} />
                    </span>
                    <div>
                      <dt className="font-display text-sm font-semibold text-ink">
                        Instant Demo — Zero Setup Required
                      </dt>
                      <dd className="text-xs text-ink-secondary mt-0.5 leading-relaxed">
                        Test all 9 workspace modules immediately with realistic pre-seeded High Court, Corporate M&amp;A, and Arbitration case files.
                      </dd>
                    </div>
                  </div>
                </dl>
              </div>
            </div>

            {/* Right: Clean Sign-In / Registration Card */}
            <div className="lg:col-span-6">
              <div className="neu-card rounded-3xl p-6 sm:p-8 h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-4 pb-5 border-b border-stone-hairline">
                    <div>
                      <h3 className="font-display text-lg font-semibold text-ink">
                        {mode === 'login' ? 'Workspace Sign In' : 'Create Your Account'}
                      </h3>
                      <p className="text-xs text-ink-muted mt-0.5">
                        For Judges, Advocates, Lawyers &amp; Law Students
                      </p>
                    </div>
                    <div className="neu-tab-bar rounded-xl px-1.5 py-1 flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setMode('login');
                          setError(null);
                        }}
                        className={`px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 border-b-2 ${
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
                        className={`px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 border-b-2 ${
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
                            placeholder="Adv. / Hon'ble / Student Name"
                            className="neu-input w-full px-3.5 py-2.5 text-sm rounded-xl"
                          />
                        </div>
                        <div>
                          <label htmlFor="auth-org" className="block text-xs font-medium text-ink-secondary mb-1.5">
                            Court / Chambers / Law School
                          </label>
                          <input
                            id="auth-org"
                            type="text"
                            value={organization}
                            onChange={(e) => setOrganization(e.target.value)}
                            placeholder="High Court / Chambers / NLU"
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
                          Primary Focus
                        </label>
                        <select
                          id="auth-jurisdiction"
                          value={defaultJurisdiction}
                          onChange={(e) => setDefaultJurisdiction(e.target.value as JurisdictionMode)}
                          className="neu-input w-full px-3.5 py-2.5 text-sm rounded-xl"
                        >
                          <option value="india_litigation">Indian Courts &amp; Judiciary (SC, HC, District, BNS/BNSS/BSA)</option>
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
                </div>

                <div className="mt-6 pt-5 border-t border-stone-hairline">
                  <p className="text-xs text-ink-muted leading-relaxed mb-3">
                    Want to explore everything right now without creating an account?
                  </p>
                  <button
                    type="button"
                    onClick={handleDemoEntry}
                    disabled={submitting}
                    className="neu-btn-secondary w-full py-2.5 px-4 rounded-full text-xs font-semibold whitespace-nowrap disabled:opacity-50"
                  >
                    Open Instant Demo Workspace
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet, Structured Multi-Column Footer */}
      <footer className="border-t border-stone-hairline bg-[#eae3d5] dark:bg-[#0e1415] text-ink-secondary">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-4 space-y-3">
              <div className="inline-flex items-center gap-2.5 text-ink">
                <span className="w-7 h-7 rounded-lg bg-[#0f5a5f] text-[#faf8f4] flex items-center justify-center">
                  <Scale className="w-3.5 h-3.5" strokeWidth={2} />
                </span>
                <span className="font-display text-lg font-bold tracking-tight">VidhiOS</span>
              </div>
              <p className="text-xs leading-relaxed text-ink-secondary max-w-xs">
                Verified AI Legal Intelligence Workspace built for Hon’ble Judges, Practicing Judges, Advocates, Lawyers, and Law Students across India and international forums.
              </p>
              <p className="text-[11px] text-ink-muted pt-1">
                New Delhi · Mumbai · Bengaluru · High Courts &amp; Law Universities
              </p>
            </div>

            <div className="lg:col-span-3 space-y-2.5">
              <h4 className="font-display text-xs font-semibold text-ink">Built For</h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <button
                    type="button"
                    onClick={() => focusAudienceRole('judges')}
                    className="hover:text-teal-accent transition-colors text-left"
                  >
                    Judges &amp; Practicing Judges
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => focusAudienceRole('advocates')}
                    className="hover:text-teal-accent transition-colors text-left"
                  >
                    Advocates &amp; Practicing Lawyers
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => focusAudienceRole('students')}
                    className="hover:text-teal-accent transition-colors text-left"
                  >
                    Law Students &amp; Judicial Aspirants
                  </button>
                </li>
                <li>
                  <a href="#bilingual-ai" className="hover:text-teal-accent transition-colors">
                    Hindi &amp; English Legal Assistant
                  </a>
                </li>
              </ul>
            </div>

            <div className="lg:col-span-3 space-y-2.5">
              <h4 className="font-display text-xs font-semibold text-ink">Core Capabilities</h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <a href="#live-tools" className="hover:text-teal-accent transition-colors">
                    IPC → BNS / BNSS / BSA Validator
                  </a>
                </li>
                <li>
                  <a href="#bilingual-ai" className="hover:text-teal-accent transition-colors">
                    13 Court Forms &amp; .DOCX Export
                  </a>
                </li>
                <li>
                  <a href="#bilingual-ai" className="hover:text-teal-accent transition-colors">
                    Courtroom &amp; Moot Simulator
                  </a>
                </li>
                <li>
                  <a href="#live-tools" className="hover:text-teal-accent transition-colors">
                    Limitation Act &amp; Cause Lists
                  </a>
                </li>
              </ul>
            </div>

            <div className="lg:col-span-2 space-y-2.5">
              <h4 className="font-display text-xs font-semibold text-ink">Get Started</h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToAuth('login')}
                    className="hover:text-teal-accent transition-colors text-left"
                  >
                    Sign In
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToAuth('register')}
                    className="hover:text-teal-accent transition-colors text-left"
                  >
                    Create Account
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={handleDemoEntry}
                    className="hover:text-teal-accent transition-colors text-left font-semibold text-teal-accent"
                  >
                    Open Demo Workspace
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-stone-hairline flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-[11px] text-ink-muted">
            <p>© 2026 VidhiOS Legal Systems. All rights reserved.</p>
            <p>
              Assists Judges, Advocates, and Law Students; independent verification is recommended before court filing.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
