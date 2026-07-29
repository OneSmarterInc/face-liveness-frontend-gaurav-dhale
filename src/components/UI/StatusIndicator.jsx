import {
  VERIFICATION_STEP_LABELS,
  FAILED_VERIFICATION_STEPS,
  COMPLETE_VERIFICATION_STEPS,
} from "../../utils/verificationStatus";

function StatusIndicator({ step, detail }) {
  if (!step) return null;

  const isFailed = FAILED_VERIFICATION_STEPS.has(step);
  const isComplete = COMPLETE_VERIFICATION_STEPS.has(step);

  const color = isFailed ? "#f87171" : isComplete ? "#22c55e" : "#60a5fa";
  const icon = isFailed ? "✕" : isComplete ? "✓" : "⏳";
  const label = VERIFICATION_STEP_LABELS[step] ?? step;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        marginTop: "16px",
        padding: "10px 16px",
        borderRadius: "10px",
        background: "#1a2332",
      }}
    >
      <span style={{ fontSize: "16px", color }}>{icon}</span>
      <div style={{ textAlign: "left" }}>
        <div style={{ color: "#f3f4f6", fontSize: "14px", fontWeight: 600 }}>
          {label}
        </div>
        {detail && (
          <div style={{ color: "#9ca3af", fontSize: "12px", marginTop: "2px" }}>
            {detail}
          </div>
        )}
      </div>
    </div>
  );
}

export default StatusIndicator;