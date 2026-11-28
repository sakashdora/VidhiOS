import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Bot,
  Building2,
  Calendar,
  CalendarClock,
  Check,
  Cpu,
  FileCheck2,
  FileEdit,
  FileSignature,
  FolderSearch,
  Gavel,
  Languages,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  Mic,
  Scale,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { api, setAuthToken } from './lib/api';
import { AuthGate } from './components/AuthGate';
import { LoadingPanel } from './components/ui/DesignSystem';
import type {
  JurisdictionMode,
  UserProfile,
  WorkspaceBundle,
  WorkspaceSection,
} from './types/legal';

const OverviewModule = lazy(() =>
  import('./components/OverviewModule').then((m) => ({ default: m.OverviewModule }))
);
const VidhiAssistantModule = lazy(() =>
  import('./components/VidhiAssistantModule').then((m) => ({ default: m.VidhiAssistantModule }))
);
const ResearchModule = lazy(() =>
  import('./components/ResearchModule').then((m) => ({ default: m.ResearchModule }))
);
const CaseTrackerModule = lazy(() =>
  import('./components/CaseTrackerModule').then((m) => ({ default: m.CaseTrackerModule }))
);
const CaseIntelligenceModule = lazy(() =>
  import('./components/CaseIntelligenceModule').then((m) => ({ default: m.CaseIntelligenceModule }))
);
const DraftingModule = lazy(() =>
  import('./components/DraftingModule').then((m) => ({ default: m.DraftingModule }))
);
const JudiciaryFormsPanel = lazy(() =>
  import('./components/JudiciaryFormsPanel').then((m) => ({ default: m.JudiciaryFormsPanel }))
);
const VaultModule = lazy(() =>
  import('./components/VaultModule').then((m) => ({ default: m.VaultModule }))
);
const ContractRedlineModule = lazy(() =>
  import('./components/ContractRedlineModule').then((m) => ({ default: m.ContractRedlineModule }))
);
const CourtroomModule = lazy(() =>
  import('./components/CourtroomModule').then((m) => ({ default: m.CourtroomModule }))
);
const CourtCalendarModule = lazy(() =>
  import('./components/CalendarAndTeamModule').then((m) => ({ default: m.CourtCalendarModule }))
);
const LegalLibraryModule = lazy(() =>
  import('./components/CorporateAndLibraryModule').then((m) => ({ default: m.LegalLibraryModule }))
);
const CorporateIntelligenceModule = lazy(() =>
  import('./components/CorporateAndLibraryModule').then((m) => ({
    default: m.CorporateIntelligenceModule,
  }))
);
const TranslationStudioModule = lazy(() =>
  import('./components/TranslationAndMeetingsModule').then((m) => ({
    default: m.TranslationStudioModule,
  }))
);
const MeetingAssistantModule = lazy(() =>
  import('./components/TranslationAndMeetingsModule').then((m) => ({
    default: m.MeetingAssistantModule,
  }))
);
const AnalyticsModule = lazy(() =>
  import('./components/CalendarAndTeamModule').then((m) => ({ default: m.AnalyticsModule }))
);
const TeamAndClientsModule = lazy(() =>
  import('./components/CalendarAndTeamModule').then((m) => ({ default: m.TeamAndClientsModule }))
);
const SettingsModule = lazy(() =>
  import('./components/CalendarAndTeamModule').then((m) => ({ default: m.SettingsModule }))
);
const AdminPanel = lazy(() =>
  import('./components/AdminPanel').then((m) => ({ default: m.AdminPanel }))
);

const NAV_ITEMS: Array<{
  id: WorkspaceSection;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'assistant', label: 'AI Assistant', icon: Bot },
  { id: 'research', label: 'Legal Research', icon: BookOpen },
  { id: 'cases', label: 'Matters & Cases', icon: CalendarClock },
  { id: 'intelligence', label: 'Case Intelligence', icon: Cpu },
  { id: 'drafting', label: 'Legal Drafting', icon: FileEdit },
  { id: 'forms', label: 'Judiciary Forms', icon: FileSignature },
  { id: 'vault', label: 'Document Vault', icon: FolderSearch },
  { id: 'redline', label: 'Contract Intelligence', icon: FileCheck2 },
  { id: 'courtroom', label: 'Courtroom Simulator', icon: Gavel },
  { id: 'calendar', label: 'Court Calendar', icon: Calendar },
  { id: 'library', label: 'Legal Library', icon: Library },
  { id: 'corporate', label: 'Corporate Intelligence', icon: Building2 },
  { id: 'translation', label: 'Translation Studio', icon: Languages },
  { id: 'meetings', label: 'Meeting Assistant', icon: Mic },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'team', label: 'Team & Clients', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'admin', label: 'Admin Console', icon: ShieldCheck },
];

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [bundle, setBundle] = useState<WorkspaceBundle | null>(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [activeSection, setActiveSection] = useState<WorkspaceSection>('overview');
  const [activeMatterId, setActiveMatterId] = useState<string>('');
  const [jurisdiction, setJurisdiction] = useState<JurisdictionMode>('india_litigation');
  const [darkMode, setDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 3800);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  const refreshWorkspace = useCallback(async () => {
    const ws = await api.getWorkspace();
    setBundle(ws);
    return ws;
  }, []);

  const hydrateWorkspace = useCallback(
    async (loggedInUser: UserProfile) => {
      setUser(loggedInUser);
      setLoadingWorkspace(true);
      try {
        const ws = await api.getWorkspace();
        setBundle(ws);
        const firstMatter = ws.matters[0];
        if (firstMatter) {
          setActiveMatterId(firstMatter.id);
          setJurisdiction(firstMatter.jurisdiction);
        } else {
          setJurisdiction(loggedInUser.defaultJurisdiction);
        }
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not load workspace.');
      } finally {
        setLoadingWorkspace(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1' && !user) {
      api
        .demoLogin()
        .then((res) => {
          setAuthToken(res.token, res.csrfToken);
          return hydrateWorkspace(res.user);
        })
        .catch(() => {});
    }
  }, [hydrateWorkspace, user]);

  const activeMatter = useMemo(() => {
    if (!bundle) return null;
    return bundle.matters.find((m) => m.id === activeMatterId) ?? bundle.matters[0] ?? null;
  }, [bundle, activeMatterId]);

  const handleSelectMatter = (matterId: string) => {
    setActiveMatterId(matterId);
    const found = bundle?.matters.find((m) => m.id === matterId);
    if (found) {
      setJurisdiction(found.jurisdiction);
    }
  };

  const handleSignOut = async () => {
    try {
      await api.logout();
    } catch {
      // Clear local session regardless
    }
    setAuthToken(null, null);
    setUser(null);
    setBundle(null);
    setActiveSection('overview');
  };

  const isAdmin = Boolean(
    user &&
      user.email !== 'chambers@vidhios.in' &&
      (user.isAdmin ||
        user.role?.toLowerCase() === 'admin' ||
        user.role?.toLowerCase() === 'administrator' ||
        user.email === 'vidhios@admin.com')
  );

  const visibleNavItems = useMemo(() => {
    return NAV_ITEMS.filter((item) => {
      if (item.id === 'admin') return isAdmin;
      if (user?.orgRole === 'client') {
        return ['overview', 'cases', 'vault', 'calendar', 'settings'].includes(item.id);
      }
      return true;
    });
  }, [isAdmin, user?.orgRole]);

  if (!user) {
    return <AuthGate onAuthenticated={hydrateWorkspace} />;
  }

  const activeNav = NAV_ITEMS.find((n) => n.id === activeSection) ?? NAV_ITEMS[0];

  const scopedMemos =
    bundle?.researchMemos.filter((m) => !activeMatter || m.matterId === activeMatter.id) ?? [];
  const scopedDrafts =
    bundle?.drafts.filter((d) => !activeMatter || d.matterId === activeMatter.id) ?? [];
  const scopedVault =
    bundle?.vaultDocuments.filter((v) => !activeMatter || v.matterId === activeMatter.id) ?? [];
  const scopedReviews =
    bundle?.contractReviews.filter((c) => !activeMatter || c.matterId === activeMatter.id) ?? [];
  const scopedSessions =
    bundle?.courtroomSessions.filter((s) => !activeMatter || s.matterId === activeMatter.id) ?? [];

  const sidebarContent = (
    <div className="h-full flex flex-col bg-[#f4f1ea] dark:bg-[#141c1e] border-r border-stone-hairline">
      <div className="h-14 px-4 flex items-center justify-between border-b border-stone-hairline shrink-0">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-teal-accent shrink-0" strokeWidth={2} />
          <span className="font-display text-base font-bold tracking-tight text-ink">VidhiOS</span>
        </div>
        <button
          type="button"
          aria-label="Close navigation drawer"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1.5 text-ink-muted hover:text-ink rounded-lg"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 border-b border-stone-hairline">
        <label
          htmlFor="sidebar-matter-select"
          className="block text-[10px] uppercase tracking-wider font-semibold text-ink-muted mb-1"
        >
          Active Matter
        </label>
        <select
          id="sidebar-matter-select"
          value={activeMatter?.id ?? ''}
          onChange={(e) => handleSelectMatter(e.target.value)}
          className="neu-input w-full px-2.5 py-1.5 text-xs font-medium rounded-lg truncate"
        >
          {bundle?.matters.map((m) => (
            <option key={m.id} value={m.id}>
              {m.matterCode} — {m.title}
            </option>
          ))}
        </select>
      </div>

      <nav aria-label="Workspace modules" className="flex-1 p-2.5 space-y-0.5 overflow-y-auto">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const active = item.id === activeSection;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveSection(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg transition-colors whitespace-nowrap ${
                active
                  ? 'bg-[#0d5c63] text-white font-semibold'
                  : 'text-ink-secondary hover:bg-[#e9e4d8] dark:hover:bg-[#1e2a2d] hover:text-ink font-medium'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" strokeWidth={1.85} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-3.5 border-t border-stone-hairline space-y-3 bg-[#ece8de]/70 dark:bg-[#111718]">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-ink truncate">{user.fullName}</p>
          <p className="text-[11px] text-ink-muted truncate">{user.organization || user.email}</p>
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={darkMode}
            aria-label="Toggle color theme"
            onClick={() => setDarkMode((d) => !d)}
            className="inline-flex items-center gap-2 text-xs font-medium text-ink-secondary hover:text-ink"
          >
            <span
              className={`relative inline-flex items-center w-10 h-5 rounded-full px-0.5 transition-colors ${
                darkMode ? 'bg-[#168089] justify-end' : 'bg-[#d5cfc2] justify-start'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white shadow-xs block" />
            </span>
            <span>Dark</span>
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Sign out"
            className="neu-btn-secondary inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen neu-canvas flex overflow-x-clip">
      <aside className="hidden lg:block w-60 shrink-0 sticky top-0 h-screen">{sidebarContent}</aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-64 max-w-[82vw] h-full shadow-2xl">{sidebarContent}</div>
          <button
            type="button"
            aria-label="Dismiss navigation backdrop"
            onClick={() => setMobileMenuOpen(false)}
            className="flex-1 bg-[#101617]/55 backdrop-blur-xs"
          />
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 px-4 lg:px-8 py-2.5 bg-[var(--canvas)]/95 backdrop-blur-sm border-b border-stone-hairline">
          <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                aria-label="Open navigation menu"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden neu-btn-secondary p-2 rounded-lg shrink-0"
              >
                <Menu className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2 text-xs min-w-0">
                <span className="font-mono font-medium text-teal-accent hidden sm:inline whitespace-nowrap">
                  {activeMatter?.matterCode ?? 'Workspace'}
                </span>
                <span aria-hidden="true" className="text-ink-muted/60 hidden sm:inline">
                  /
                </span>
                <h1 className="font-display font-semibold text-ink truncate text-sm">
                  {activeNav.label}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {activeSection !== 'assistant' && (
                <button
                  type="button"
                  onClick={() => setActiveSection('assistant')}
                  className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold neu-btn-secondary whitespace-nowrap"
                >
                  <Bot className="w-3.5 h-3.5 text-teal-accent" />
                  <span>Ask Vidhi AI</span>
                </button>
              )}
              <select
                id="global-jurisdiction"
                aria-label="Active Legal Jurisdiction"
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value as JurisdictionMode)}
                className="neu-input px-3 py-1.5 text-xs font-medium rounded-lg max-w-[180px] sm:max-w-none truncate"
              >
                <option value="india_litigation">Indian Litigation (BNS / SC / HC)</option>
                <option value="corporate_ma">Corporate M&amp;A &amp; Commercial</option>
                <option value="global_multi">Global Multi-Jurisdiction &amp; SIAC</option>
              </select>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {loadingWorkspace || !bundle ? (
            <LoadingPanel label="Loading VidhiOS legal workspace..." />
          ) : (
            <Suspense fallback={<LoadingPanel label={`Loading ${activeNav.label}...`} />}>
              {activeSection === 'overview' && (
                <OverviewModule
                  bundle={bundle}
                  activeMatter={activeMatter}
                  onSelectMatter={handleSelectMatter}
                  onNavigate={setActiveSection}
                  onCreateMatter={async (payload) => {
                    const created = await api.createMatter(payload);
                    setBundle((prev) =>
                      prev ? { ...prev, matters: [created, ...prev.matters] } : prev
                    );
                    setActiveMatterId(created.id);
                    setJurisdiction(created.jurisdiction);
                    showToast(`Created matter ${created.matterCode}.`);
                  }}
                  onBundleRefresh={async () => {
                    await refreshWorkspace();
                  }}
                  onToast={showToast}
                />
              )}

              {activeSection === 'assistant' && (
                <VidhiAssistantModule
                  activeMatter={activeMatter}
                  jurisdiction={jurisdiction}
                  messages={bundle.assistantMessages ?? []}
                  onMessageExchanged={(userMsg, assistantMsg, createdDraft, createdDeadline) =>
                    setBundle((prev) =>
                      prev
                        ? {
                            ...prev,
                            assistantMessages: [
                              ...(prev.assistantMessages ?? []),
                              userMsg,
                              assistantMsg,
                            ],
                            drafts: createdDraft ? [createdDraft, ...prev.drafts] : prev.drafts,
                            deadlines: createdDeadline
                              ? [...prev.deadlines, createdDeadline]
                              : prev.deadlines,
                          }
                        : prev
                    )
                  }
                  onHistoryCleared={() =>
                    setBundle((prev) => (prev ? { ...prev, assistantMessages: [] } : prev))
                  }
                  onNavigate={setActiveSection}
                  onToast={showToast}
                />
              )}

              {activeSection === 'research' && (
                <ResearchModule
                  activeMatter={activeMatter}
                  jurisdiction={jurisdiction}
                  memos={scopedMemos}
                  onMemoCreated={(memo) =>
                    setBundle((prev) =>
                      prev ? { ...prev, researchMemos: [memo, ...prev.researchMemos] } : prev
                    )
                  }
                  onToast={showToast}
                />
              )}

              {activeSection === 'cases' && (
                <CaseTrackerModule
                  activeMatter={activeMatter}
                  cases={bundle.trackedCases}
                  deadlines={bundle.deadlines}
                  onCaseAdded={(tc) =>
                    setBundle((prev) =>
                      prev ? { ...prev, trackedCases: [...prev.trackedCases, tc] } : prev
                    )
                  }
                  onCaseUpdated={(tc) =>
                    setBundle((prev) =>
                      prev
                        ? {
                            ...prev,
                            trackedCases: prev.trackedCases.map((item) =>
                              item.id === tc.id ? tc : item
                            ),
                          }
                        : prev
                    )
                  }
                  onDeadlineAdded={(dl) =>
                    setBundle((prev) =>
                      prev ? { ...prev, deadlines: [...prev.deadlines, dl] } : prev
                    )
                  }
                  onDeadlineToggled={(dl) =>
                    setBundle((prev) =>
                      prev
                        ? {
                            ...prev,
                            deadlines: prev.deadlines.map((item) =>
                              item.id === dl.id ? dl : item
                            ),
                          }
                        : prev
                    )
                  }
                  onToast={showToast}
                />
              )}

              {activeSection === 'intelligence' && (
                <CaseIntelligenceModule
                  activeMatter={activeMatter}
                  vaultDocuments={scopedVault}
                  workflowRuns={bundle.workflowRuns ?? []}
                  evidenceItems={bundle.evidenceItems ?? []}
                  strategies={bundle.litigationStrategies ?? []}
                  onRefreshWorkspace={async () => {
                    await refreshWorkspace();
                  }}
                  onToast={showToast}
                />
              )}

              {activeSection === 'drafting' && (
                <DraftingModule
                  activeMatter={activeMatter}
                  jurisdiction={jurisdiction}
                  drafts={scopedDrafts}
                  onDraftCreated={(draft) =>
                    setBundle((prev) =>
                      prev ? { ...prev, drafts: [draft, ...prev.drafts] } : prev
                    )
                  }
                  onDraftUpdated={(draft) =>
                    setBundle((prev) =>
                      prev
                        ? {
                            ...prev,
                            drafts: prev.drafts.map((d) => (d.id === draft.id ? draft : d)),
                          }
                        : prev
                    )
                  }
                  onMemoCreated={(memo) =>
                    setBundle((prev) =>
                      prev ? { ...prev, researchMemos: [memo, ...prev.researchMemos] } : prev
                    )
                  }
                  onToast={showToast}
                />
              )}

              {activeSection === 'forms' && (
                <JudiciaryFormsPanel
                  activeMatter={activeMatter}
                  jurisdiction={jurisdiction}
                  onDraftGenerated={(draft) =>
                    setBundle((prev) =>
                      prev ? { ...prev, drafts: [draft, ...prev.drafts] } : prev
                    )
                  }
                  onOpenInEditor={() => setActiveSection('drafting')}
                  onToast={showToast}
                />
              )}

              {activeSection === 'vault' && (
                <VaultModule
                  activeMatter={activeMatter}
                  documents={scopedVault}
                  onDocumentAdded={(doc) =>
                    setBundle((prev) =>
                      prev ? { ...prev, vaultDocuments: [doc, ...prev.vaultDocuments] } : prev
                    )
                  }
                  onDocumentUpdated={(doc) =>
                    setBundle((prev) =>
                      prev
                        ? {
                            ...prev,
                            vaultDocuments: prev.vaultDocuments.map((d) =>
                              d.id === doc.id ? doc : d
                            ),
                          }
                        : prev
                    )
                  }
                  onToast={showToast}
                />
              )}

              {activeSection === 'redline' && (
                <ContractRedlineModule
                  activeMatter={activeMatter}
                  reviews={scopedReviews}
                  onReviewCreated={(r) =>
                    setBundle((prev) =>
                      prev ? { ...prev, contractReviews: [r, ...prev.contractReviews] } : prev
                    )
                  }
                  onReviewUpdated={(r) =>
                    setBundle((prev) =>
                      prev
                        ? {
                            ...prev,
                            contractReviews: prev.contractReviews.map((item) =>
                              item.id === r.id ? r : item
                            ),
                          }
                        : prev
                    )
                  }
                  onToast={showToast}
                />
              )}

              {activeSection === 'courtroom' && (
                <CourtroomModule
                  activeMatter={activeMatter}
                  sessions={scopedSessions}
                  onSessionCreated={(s) =>
                    setBundle((prev) =>
                      prev
                        ? { ...prev, courtroomSessions: [s, ...prev.courtroomSessions] }
                        : prev
                    )
                  }
                  onSessionUpdated={(s) =>
                    setBundle((prev) =>
                      prev
                        ? {
                            ...prev,
                            courtroomSessions: prev.courtroomSessions.map((item) =>
                              item.id === s.id ? s : item
                            ),
                          }
                        : prev
                    )
                  }
                  onToast={showToast}
                />
              )}

              {activeSection === 'calendar' && (
                <CourtCalendarModule
                  bundle={bundle}
                  activeMatter={activeMatter}
                  onRefreshWorkspace={async () => {
                    await refreshWorkspace();
                  }}
                  onToast={showToast}
                />
              )}

              {activeSection === 'library' && <LegalLibraryModule />}

              {activeSection === 'corporate' && (
                <CorporateIntelligenceModule
                  activeMatter={activeMatter}
                  profiles={bundle.corporateProfiles ?? []}
                  onRefreshWorkspace={async () => {
                    await refreshWorkspace();
                  }}
                  onToast={showToast}
                />
              )}

              {activeSection === 'translation' && (
                <TranslationStudioModule
                  activeMatter={activeMatter}
                  jurisdiction={jurisdiction}
                  onToast={showToast}
                />
              )}

              {activeSection === 'meetings' && (
                <MeetingAssistantModule
                  activeMatter={activeMatter}
                  briefs={bundle.meetingBriefs ?? []}
                  onRefreshWorkspace={async () => {
                    await refreshWorkspace();
                  }}
                  onToast={showToast}
                />
              )}

              {activeSection === 'analytics' && <AnalyticsModule bundle={bundle} />}

              {activeSection === 'team' && (
                <TeamAndClientsModule
                  bundle={bundle}
                  onRefreshWorkspace={async () => {
                    await refreshWorkspace();
                  }}
                  onToast={showToast}
                />
              )}

              {activeSection === 'settings' && (
                <SettingsModule
                  bundle={bundle}
                  onRefreshWorkspace={async () => {
                    await refreshWorkspace();
                  }}
                  onToast={showToast}
                />
              )}

              {activeSection === 'admin' && isAdmin && (
                <AdminPanel currentUser={user} onToast={showToast} />
              )}
            </Suspense>
          )}
        </main>

        <footer className="border-t border-stone-hairline px-4 sm:px-6 lg:px-8 py-4 mt-auto">
          <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-ink-muted">
            <span>
              VidhiOS Legal Intelligence &amp; Operations Platform · Storage: {bundle?.storageEngine ?? 'initializing'}
            </span>
            <span>
              Legal Information Disclaimer: Verify citations, commencement dates &amp; official texts prior to court filing.
            </span>
          </div>
        </footer>
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="neu-toast fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2.5 max-w-sm"
        >
          <span className="w-5 h-5 rounded-full bg-[#0d5c63] text-white flex items-center justify-center shrink-0">
            <Check className="w-3 h-3" strokeWidth={2.5} />
          </span>
          <span className="text-ink">{toast}</span>
        </div>
      )}
    </div>
  );
}
