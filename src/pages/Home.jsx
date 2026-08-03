import { useAuth } from "../context/AuthContext";
import "../css/Home.css";

function Home() {
  const { logout } = useAuth();

  return (
    <div className="home-root">
      {/* Logout */}
      <button onClick={logout} className="home-logout-btn">
        Logout
      </button>

      <div className="home-card">
        <div className="home-icon">🛡️</div>

        <h1 className="home-title">Welcome to Korgut</h1>

        <p className="home-subtitle">
          Your identity has been successfully verified.
        </p>

        <div className="home-checklist">
          <div>✅ Login successful</div>
          <div>✅ TOTP verification completed</div>
          <div>✅ Liveness verification completed</div>
        </div>

        <div className="home-access-note">
          You now have access to the protected area of the application.
        </div>

        <button className="home-continue-btn">Continue</button>
      </div>
    </div>
  );
}

export default Home;
