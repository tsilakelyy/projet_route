import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ManagerLogin from './ManagerLogin';
import ManagerDashboard from './ManagerDashboard';
import VisitorDashboard from './VisitorDashboard';
import CriticalityPage from './CriticalityPage';
import AuditTrailPage from './AuditTrailPage';
import ImpactPage from './ImpactPage';
import ProjectChartsPage from './ProjectChartsPage';

// Global CSS cascade:
// 1) legacy base styles, 2) modern effects, 3) enhanced overrides.
import './styles/manager-login.css';
import './styles/route-views.css';
import './styles/modern-effects.css';
import './styles/manager-login-enhanced.css';
import './styles/route-views-enhanced.css';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<ManagerLogin />} />
          <Route path="/dashboard" element={<ManagerDashboard />} />
          <Route path="/visiteur" element={<VisitorDashboard />} />
          <Route path="/analytics/criticality" element={<CriticalityPage />} />
          <Route path="/analytics/audit" element={<AuditTrailPage />} />
          <Route path="/analytics/impact" element={<ImpactPage />} />
          <Route path="/analytics/charts" element={<ProjectChartsPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
