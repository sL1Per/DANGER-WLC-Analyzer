import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { HomePage } from "./pages/HomePage";
import { ReportPage } from "./pages/ReportPage";
import { RpbPage } from "./pages/RpbPage";
import { SettingsPage } from "./pages/SettingsPage";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/cla/:reportId" element={<ReportPage />} />
        <Route path="/rpb/:reportId" element={<RpbPage />} />
      </Routes>
    </AppShell>
  );
}
