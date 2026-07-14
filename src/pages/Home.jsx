import { useAuth } from "../context/AuthContext";

function Home() {
  const { logout } = useAuth();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#111827",
        color: "#ffffff",
        position: "relative",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "40px",
      }}
    >
      {/* Logout */}
      <button
        onClick={logout}
        style={{
          position: "absolute",
          top: "24px",
          right: "24px",
          padding: "10px 18px",
          borderRadius: "8px",
          border: "none",
          background: "#dc2626",
          color: "#fff",
          cursor: "pointer",
          fontWeight: "600",
        }}
      >
        Logout
      </button>

      <div
        style={{
          width: "100%",
          maxWidth: "700px",
          background: "#1f2937",
          borderRadius: "16px",
          padding: "50px",
          boxShadow: "0 10px 30px rgba(0,0,0,.35)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: "64px",
            marginBottom: "20px",
          }}
        >
          🛡️
        </div>

        <h1
          style={{
            marginBottom: "12px",
          }}
        >
          Welcome to Korgut
        </h1>

        <p
          style={{
            color: "#9ca3af",
            marginBottom: "40px",
            fontSize: "17px",
          }}
        >
          Your identity has been successfully verified.
        </p>

        <div
          style={{
            textAlign: "left",
            display: "inline-block",
            fontSize: "18px",
            lineHeight: "2.2",
          }}
        >
          <div>✅ Login successful</div>
          <div>✅ TOTP verification completed</div>
          <div>✅ Liveness verification completed</div>
        </div>

        <div
          style={{
            marginTop: "45px",
            color: "#d1d5db",
          }}
        >
          You now have access to the protected area of the application.
        </div>

        <button
          style={{
            marginTop: "35px",
            padding: "14px 32px",
            borderRadius: "10px",
            border: "none",
            background: "#2563eb",
            color: "#fff",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: "600",
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

export default Home;