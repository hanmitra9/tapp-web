import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AdminGate } from './auth';
import { Layout } from './components/Layout';
import { Creators } from './pages/Creators';
import { Dashboard } from './pages/Dashboard';
import { Audit } from './pages/Audit';
import { Brands } from './pages/Brands';
import { Campaigns } from './pages/Campaigns';
import { Disputes } from './pages/Disputes';
import { Payouts } from './pages/Payouts';
import { Support } from './pages/Support';
import { Submissions } from './pages/Submissions';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminGate>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="submissions" element={<Submissions mode="review" />} />
            <Route path="performance" element={<Submissions mode="performance" />} />
            <Route path="creators" element={<Creators />} />
            <Route path="payouts" element={<Payouts />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="brands" element={<Brands />} />
            <Route path="disputes" element={<Disputes />} />
            <Route path="support" element={<Support />} />
            <Route path="audit" element={<Audit />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AdminGate>
  </StrictMode>,
);
