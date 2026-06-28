import { Navigate, Route, Routes, useParams, useLocation } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { HomePage } from "./pages/HomePage";
import { ReportPage } from "./pages/ReportPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SharedReportPage } from "./pages/SharedReportPage";

function LegacyRedirect({ cat }: { cat: string }) {
  const { reportId = "" } = useParams();
  const { search } = useLocation();
  const sep = search ? `${search}&` : "?";
  return <Navigate to={`/report/${reportId}${sep}cat=${cat}`} replace />;
}

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/report/:reportId" element={<ReportPage />} />
        <Route path="/cla/:reportId" element={<LegacyRedirect cat="gear" />} />
        <Route path="/rpb/:reportId" element={<LegacyRedirect cat="performance" />} />
        <Route path="/s/:shareId" element={<SharedReportPage />} />
      </Routes>
    </AppShell>
  );
}
