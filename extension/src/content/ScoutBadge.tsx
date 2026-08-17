/**
 * Small corner badge that toggles the scout view. Shown whenever a match is
 * active; clicking it opens the scout overlay (in-modal or floating) without
 * cluttering the page by default.
 */

import React from "react";

interface Props {
  onClick: () => void;
  label?: string;
}

export const ScoutBadge: React.FC<Props> = ({ onClick, label = "Scout" }) => {
  return (
    <button type="button" onClick={onClick} title="Open match scout" style={styles.badge}>
      <span style={styles.icon}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="12" r="3" fill="currentColor" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="2" />
        </svg>
      </span>
      <span style={styles.label}>{label}</span>
    </button>
  );
};

const styles: Record<string, React.CSSProperties> = {
  badge: {
    position: "fixed",
    right: 16,
    bottom: 16,
    zIndex: 2147483646,
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "#1a1a2e",
    color: "#e94560",
    border: "1px solid #e94560",
    borderRadius: 20,
    padding: "8px 14px",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    boxShadow: "0 4px 16px rgba(233, 69, 96, 0.4)",
    userSelect: "none",
  },
  icon: {
    display: "flex",
    alignItems: "center",
  },
  label: {
    lineHeight: 1,
  },
};
