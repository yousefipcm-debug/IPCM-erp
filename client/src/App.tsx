import { BrowserRouter, MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { IS_DEMO } from '@/lib/api';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from '@/lib/auth';
import { DataProvider } from '@/lib/data';
import { ConfirmProvider } from '@/components/ui/dialog';
import { AppShell } from '@/components/layout/AppShell';
import { Splash } from '@/components/layout/Splash';
import { LoginPage } from '@/pages/Login';
import { OverviewPage } from '@/pages/pilotage/Overview';
import { AlertsPage } from '@/pages/pilotage/Alerts';
import { ProjectsPage } from '@/pages/pilotage/Projects';
import { JournalsPage } from '@/pages/finance/Journals';
import { SituationsPage } from '@/pages/finance/Situations';
import { PartiesPage, PartyDetailPage } from '@/pages/finance/Parties';
import { AgingPage, ChargesPage, ForecastPage } from '@/pages/finance/Analysis';
import { SimulatorPage } from '@/pages/finance/Simulator';
import { PettyCashPage } from '@/pages/finance/PettyCash';
import { ActivityPage, CompanyPage, UsersPage } from '@/pages/admin/Admin';
import { ComingSoonPage, NotFoundPage } from '@/pages/ComingSoon';
import type { Role } from '@/lib/types';
import type { ReactNode } from 'react';
import { NAV } from '@/nav';

function Guard({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  return roles.includes(user!.role) ? <>{children}</> : <Navigate to="/" replace />;
}
const FIN: Role[] = ['admin', 'finance'];

function Authed() {
  return (
    <DataProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<OverviewPage />} />
          <Route path="alertes" element={<Guard roles={FIN}><AlertsPage /></Guard>} />
          <Route path="projets" element={<Guard roles={FIN}><ProjectsPage /></Guard>} />
          <Route path="dfc/journaux" element={<Guard roles={FIN}><JournalsPage /></Guard>} />
          <Route path="dfc/situations" element={<Guard roles={FIN}><SituationsPage /></Guard>} />
          <Route path="dfc/clients" element={<Guard roles={FIN}><PartiesPage kind="clients" key="c" /></Guard>} />
          <Route path="dfc/clients/:id" element={<Guard roles={FIN}><PartyDetailPage kind="clients" key="cd" /></Guard>} />
          <Route path="dfc/fournisseurs" element={<Guard roles={FIN}><PartiesPage kind="suppliers" key="s" /></Guard>} />
          <Route path="dfc/fournisseurs/:id" element={<Guard roles={FIN}><PartyDetailPage kind="suppliers" key="sd" /></Guard>} />
          <Route path="dfc/balance-agee" element={<Guard roles={FIN}><AgingPage /></Guard>} />
          <Route path="dfc/previsionnel" element={<Guard roles={FIN}><ForecastPage /></Guard>} />
          <Route path="dfc/charges" element={<Guard roles={FIN}><ChargesPage /></Guard>} />
          <Route path="dfc/simulateur" element={<Guard roles={FIN}><SimulatorPage /></Guard>} />
          <Route path="dfc/caisse-terkmane" element={<Guard roles={FIN}><PettyCashPage /></Guard>} />
          <Route path="admin/utilisateurs" element={<Guard roles={['admin']}><UsersPage /></Guard>} />
          <Route path="admin/activite" element={<Guard roles={['admin']}><ActivityPage /></Guard>} />
          <Route path="admin/entreprise" element={<Guard roles={['admin']}><CompanyPage /></Guard>} />
          {NAV.flatMap((g) => g.items).filter((i) => i.soon).map((i) => <Route key={i.to} path={i.to.slice(1)} element={<ComingSoonPage />} />)}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </DataProvider>
  );
}

function Root() {
  const { user, checking } = useAuth();
  if (checking) return null;
  return user ? <Authed key={user.id} /> : <LoginPage />;
}

export function App() {
  const Router: any = IS_DEMO ? MemoryRouter : BrowserRouter;
  return (
    <Router>
      <AuthProvider>
        <ConfirmProvider>
          <Root />
          <Splash />
          <Toaster position="bottom-right" closeButton toastOptions={{ className: 'font-sans', style: { background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--line)' } }} />
        </ConfirmProvider>
      </AuthProvider>
    </Router>
  );
}
