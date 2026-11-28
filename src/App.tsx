import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Bot,
  CalendarClock,
  Check,
  FileCheck2,
  FileEdit,
  FolderSearch,
  Gavel,
  LayoutDashboard,
  LogOut,
  Menu,
  Scale,
  ShieldCheck,
  X,
} from 'lucide-react';
import { api, setAuthToken } from './lib/api';
import { AuthGate } from './components/AuthGate';
import { OverviewModule } from './components/OverviewModule';
import { VidhiAssistantModule } from './components/VidhiAssistantModule';
import { ResearchModule } from './components/ResearchModule';
import { DraftingModule } from './components/DraftingModule';
import { CourtroomModule } from './components/CourtroomModule';
import { ContractRedlineModule } from './components/ContractRedlineModule';
import { VaultModule } from './components/VaultModule';
import { CaseTrackerModule } from './components/CaseTrackerModule';
import { AdminPanel } from './components/AdminPanel';
import type {
  JurisdictionMode,
  UserProfile,
  WorkspaceBundle,
  WorkspaceSection,
} from './types/legal';

const NAV_ITEMS: Array<{
  id: WorkspaceSection;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}> = [
    { id: 'overview', label: 'Command Overview', shortLabel: 'Overview', icon: LayoutDashboard },
    { id: 'assistant', label: 'VidhiOS Assistant', shortLabel: 'Assistant', icon: Bot },
    { id: 'research', label: 'Legal Research', shortLabel: 'Research', icon: BookOpen },
    { id: 'drafting', label: 'Drafting & Forms', shortLabel: 'Drafting', icon: FileEdit },
    { id: 'courtroom', label: 'Courtroom Simulator', shortLabel: 'Courtroom', icon: Gavel },
    { id: 'redline', label: 'Contract Redline & DD', shortLabel: 'Redline', icon: FileCheck2 },
    { id: 'vault', label: 'Document Vault & OCR', shortLabel: 'Vault', icon: FolderSearch },
    { id: 'cases', label: 'Cases & Limitation', shortLabel: 'Cases', icon: CalendarClock },
    { id: 'admin', label: 'Admin Panel', shortLabel: 'Admin', icon: ShieldCheck },
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

  const hydrateWorkspace = useCallback(async (loggedInUser: UserProfile) => {
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
  }, [showToast]);

  // Support ?autostart=1 for instant demo workspace boot
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1' && !user) {
      api
        .demoLogin()
        .then((res) => {
          setAuthToken(res.token);
          return hydrateWorkspace(res.user);
        })
        .catch(() => {
          // Falls back gracefully to AuthGate
        });
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

  const handleSignOut = () => {
    setAuthToken(null);
    setUser(null);
    setBundle(null);
    setActiveSection('overview');
  };

  const isAdmin = Boolean(
    user?.isAdmin ||
    user?.role?.toLowerCase() === 'admin' ||
    user?.role?.toLowerCase() === 'administrator' ||
    user?.email === 'vidhios@admin.com' ||
    user?.email === 'chambers@vidhios.in'
  );

  const visibleNavItems = useMemo(() => {
    return NAV_ITEMS.filter((item) => {
      if (item.id === 'admin') return isAdmin;
      return true;
    });
  }, [isAdmin]);

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
    <div className="h-full flex flex-col bg-[#f4efe6] dark:bg-[#161e20] border-r border-stone-hairline">
      {/* Brand Wordmark */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-stone-hairline shrink-0">
        <div className="flex items-center gap-2.5">
          <Scale className="w-5 h-5 text-teal-accent shrink-0" strokeWidth={2} />
          <span className="font-display text-base font-bold tracking-tight text-ink whitespace-nowrap">
            VidhiOS
          </span>
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

      {/* Active Matter Switcher */}
      <div className="p-4 border-b border-stone-hairline">
        <label
          htmlFor="sidebar-matter-select"
          className="block text-[11px] font-medium text-ink-muted mb-1.5"
        >
          Active Matter Context
        </label>
        <select
          id="sidebar-matter-select"
          value={activeMatter?.id ?? ''}
          onChange={(e) => handleSelectMatter(e.target.value)}
          className="neu-input w-full px-3 py-2 text-xs font-medium rounded-xl truncate"
        >
          {bundle?.matters.map((m) => (
            <option key={m.id} value={m.id}>
              {m.matterCode} — {m.title}
            </option>
          ))}
        </select>
      </div>

      {/* Navigation Links */}
      <nav aria-label="Workspace modules" className="flex-1 p-3.5 space-y-1.5 overflow-y-auto">
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
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm rounded-xl transition-all whitespace-nowrap ${active
                ? 'bg-[#0f5a5f] dark:bg-[#14777e] text-[#faf8f4] font-semibold shadow-sm'
                : 'text-ink-secondary hover:bg-[#eae3d5] dark:hover:bg-[#1f2a2d] hover:text-ink font-medium'
                }`}
            >
              <Icon className="w-4 h-4 shrink-0" strokeWidth={2} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Account & Tactile Theme Switch Footer */}
      <div className="p-4 border-t border-stone-hairline space-y-3.5 bg-[#efe9dc]/60 dark:bg-[#131a1c]">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-ink truncate">
            {user.fullName}
          </p>
          <p className="text-[11px] text-ink-muted truncate">
            {user.organization || user.email}
          </p>
        </div>

        <div className="flex items-center justify-between gap-2">
          {/* Tactile Reference-Style ON/OFF Dark Mode Switch */}
          <button
            type="button"
            role="switch"
            aria-checked={darkMode}
            aria-label="Toggle color theme"
            onClick={() => setDarkMode((d) => !d)}
            className="inline-flex items-center gap-2 text-xs font-medium text-ink-secondary hover:text-ink transition-colors"
          >
            <span
              className={`relative inline-flex items-center w-12 h-6 rounded-full px-1 transition-colors ${darkMode
                ? 'bg-[#14777e] justify-end'
                : 'neu-inset justify-start'
                }`}
            >
              <span
                className={`text-[9px] font-mono font-bold absolute ${darkMode ? 'left-1.5 text-[#faf8f4]' : 'right-1.5 text-ink-muted'
                  }`}
              >
                {darkMode ? 'ON' : 'OFF'}
              </span>
              <span className="w-4 h-4 rounded-full bg-[#faf7f0] shadow-sm block" />
            </span>
            <span className="whitespace-nowrap">Dark</span>
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Sign out"
            className="neu-btn-secondary inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Exit</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen neu-canvas flex overflow-x-clip">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-64 max-w-[82vw] h-full shadow-2xl">{sidebarContent}</div>
          <button
            type="button"
            aria-label="Dismiss navigation backdrop"
            onClick={() => setMobileMenuOpen(false)}
            className="flex-1 bg-[#121819]/55 backdrop-blur-xs"
          />
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Architectural Workspace Top Bar */}
        <header className="sticky top-0 z-30 px-4 lg:px-8 pt-2.5 pb-2 bg-[#efeae0]/88 dark:bg-[#121819]/88 backdrop-blur-md">
          <div className="max-w-[1440px] mx-auto h-14 rounded-2xl bg-[#faf7f0]/95 dark:bg-[#192224]/95 border border-[#ddd5c5] dark:border-[#263336] shadow-sm px-3.5 sm:px-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                aria-label="Open navigation menu"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden neu-btn-secondary p-2 rounded-xl shrink-0"
              >
                <Menu className="w-4 h-4" strokeWidth={2} />
              </button>

              <div className="flex items-center gap-2 text-xs min-w-0">
                <span className="font-mono font-medium text-teal-accent hidden sm:inline whitespace-nowrap">
                  {activeMatter?.matterCode ?? 'Workspace'}
                </span>
                <span aria-hidden="true" className="text-ink-muted/60 hidden sm:inline">
                  /
                </span>
                <h1 className="font-display font-semibold text-ink truncate text-xs sm:text-sm">
                  {activeNav.label}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {activeSection !== 'assistant' && (
                <button
                  type="button"
                  onClick={() => setActiveSection('assistant')}
                  className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold neu-btn-secondary whitespace-nowrap shrink-0"
                >
                  <Bot className="w-3.5 h-3.5 text-teal-accent" strokeWidth={2} />
                  <span>Hindi / EN AI</span>
                </button>
              )}

              <label htmlFor="global-jurisdiction" className="sr-only">
                Active Legal Jurisdiction
              </label>
              <select
                id="global-jurisdiction"
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value as JurisdictionMode)}
                className="neu-input px-3 sm:px-3.5 py-1.5 text-xs font-medium rounded-full max-w-[148px] sm:max-w-none truncate"
              >
                <option value="india_litigation">Indian Litigation (BNS / SC / HC)</option>
                <option value="corporate_ma">Corporate M&amp;A &amp; Commercial</option>
                <option value="global_multi">Global Multi-Jurisdiction &amp; SIAC</option>
              </select>
            </div>
          </div>
        </header>

        {/* Active Module Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {loadingWorkspace || !bundle ? (
            <div className="space-y-5 animate-pulse">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-28 rounded-2xl neu-card-flat" />
                ))}
              </div>
              <div className="h-72 rounded-2xl neu-card-flat" />
            </div>
          ) : (
            <>
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

              {activeSection === 'vault' && (
                <VaultModule
                  activeMatter={activeMatter}
                  documents={scopedVault}
                  onDocumentAdded={(doc) =>
                    setBundle((prev) =>
                      prev ? { ...prev, vaultDocuments: [doc, ...prev.vaultDocuments] } : prev
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

              {activeSection === 'admin' && user && (
                <AdminPanel currentUser={user} onToast={showToast} />
              )}
            </>
          )}
        </main>

        {/* Clean, Quiet Workspace Footer */}
        <footer className="border-t border-stone-hairline px-4 sm:px-6 lg:px-8 py-5 mt-auto">
          <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-ink-muted">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="font-display font-semibold text-ink">VidhiOS</span>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => setActiveSection('overview')}
                className="hover:text-teal-accent transition-colors"
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('drafting')}
                className="hover:text-teal-accent transition-colors"
              >
                BNS Validator
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('redline')}
                className="hover:text-teal-accent transition-colors"
              >
                Contract Redline
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('cases')}
                className="hover:text-teal-accent transition-colors"
              >
                Limitation Calendar
              </button>
            </div>
            <p className="text-[11px]">
              © 2026 VidhiOS Chambers · Verify citations independently prior to court filing.
            </p>
          </div>
        </footer>
      </div>

      {/* Floating Bilingual VidhiOS Assistant Quick-Access Button on other modules */}
      {activeSection !== 'assistant' && (
        <button
          type="button"
          onClick={() => setActiveSection('assistant')}
          aria-label="Open VidhiOS Hindi and English Assistant"
          className="neu-btn-primary fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-full shadow-lg"
        >
          <Bot className="w-4 h-4" strokeWidth={2} />
          <span>VidhiOS सहायक / AI</span>
        </button>
      )}

      {/* Reference-Style Tactile Toast Card */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="neu-toast fixed bottom-20 right-5 z-50 px-4 py-3 rounded-2xl text-xs font-medium flex items-center gap-2.5 max-w-sm"
        >
          <span className="w-5 h-5 rounded-full bg-[#0f5a5f] text-[#faf8f4] flex items-center justify-center shrink-0">
            <Check className="w-3 h-3" strokeWidth={2.5} />
          </span>
          <span className="text-ink">{toast}</span>
        </div>
      )}
    </div>
  );
}
