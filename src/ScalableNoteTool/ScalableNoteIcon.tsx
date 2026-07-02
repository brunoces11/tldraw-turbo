export function ScalableNoteIcon() {
  return (
    <div
      className="tlui-icon"
      role="img"
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
      }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <path
          d="M4.5 3.5h10.2c.8 0 1.4.6 1.4 1.4v7.9l-3.3 3.7H4.5c-.8 0-1.4-.6-1.4-1.4V4.9c0-.8.6-1.4 1.4-1.4Z"
          fill="currentColor"
          opacity="0.82"
        />
        <path d="M12.7 16.5v-2.7c0-.6.4-1 1-1h2.4" fill="none" stroke="white" strokeWidth="1.4" />
        <path d="M10 6.2v5.6M7.2 9h5.6" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </div>
  );
}
