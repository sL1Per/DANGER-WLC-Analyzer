import { Link, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { ReportPage } from "./pages/ReportPage";
import { SettingsPage } from "./pages/SettingsPage";

export default function App() {
  return (
    <div className="app">
      <nav>
        <Link to="/">Home</Link> · <Link to="/settings">Settings</Link>
      </nav>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/report/:reportId" element={<ReportPage />} />
      </Routes>
    </div>
  );
}
