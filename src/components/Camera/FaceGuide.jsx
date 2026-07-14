function FaceGuide() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: "260px",
          height: "340px",
          border: "4px solid rgba(255,255,255,0.8)",
          borderRadius: "50%",
        }}
      />
    </div>
  );
}

export default FaceGuide;