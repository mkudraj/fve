/**
 * Options page - API key configuration and display toggles.
 */

import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { ScoutOptions } from "../shared/types.js";

const DEFAULT_OPTIONS: ScoutOptions = {
  faceitApiKey: "",
  enableOverlay: true,
  showSteamName: true,
  showFaceitLevel: true,
  showMembership: true,
  showTechnicalIds: false,
};

const Options: React.FC = () => {
  const [options, setOptions] = useState<ScoutOptions>(DEFAULT_OPTIONS);
  const [status, setStatus] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    chrome.storage.local.get("scoutOptions", (result) => {
      if (result.scoutOptions) {
        setOptions({ ...DEFAULT_OPTIONS, ...result.scoutOptions });
      }
    });
  }, []);

  const save = () => {
    chrome.storage.local.set({ scoutOptions: options }, () => {
      setStatus({ type: "ok", text: "Saved." });
      setTimeout(() => setStatus(null), 2000);
    });
  };

  const testKey = async () => {
    if (!options.faceitApiKey) {
      setStatus({ type: "error", text: "Enter an API key first." });
      return;
    }
    setTesting(true);
    setStatus(null);

    try {
      const res = await fetch(
        "https://open.faceit.com/data/v4/matches/1-ed06863c-ee54-4fe1-9278-475d72991017",
        {
          headers: {
            Authorization: `Bearer ${options.faceitApiKey}`,
            Accept: "application/json",
          },
        },
      );

      if (res.ok) {
        setStatus({ type: "ok", text: "Key is valid (HTTP 200)." });
      } else if (res.status === 401 || res.status === 403) {
        setStatus({ type: "error", text: `Invalid key (HTTP ${res.status}).` });
      } else {
        setStatus({
          type: "ok",
          text: `Key works (HTTP ${res.status} - match may not exist).`,
        });
      }
    } catch {
      setStatus({ type: "error", text: "Network error - check your connection." });
    } finally {
      setTesting(false);
    }
  };

  const update = (patch: Partial<ScoutOptions>) => {
    setOptions((prev) => ({ ...prev, ...patch }));
  };

  return (
    <div>
      <h1>FACEIT Pre-Match Scout</h1>

      <div className="form-group">
        <label htmlFor="apiKey">FACEIT API Key</label>
        <input
          id="apiKey"
          type="password"
          value={options.faceitApiKey}
          onChange={(e) => update({ faceitApiKey: e.target.value })}
          placeholder="Enter your FACEIT Data API key..."
        />
      </div>

      <div className="form-group">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={options.enableOverlay}
            onChange={(e) => update({ enableOverlay: e.target.checked })}
          />
          Enable overlay
        </label>
      </div>

      <div className="form-group">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={options.showSteamName}
            onChange={(e) => update({ showSteamName: e.target.checked })}
          />
          Show Steam name
        </label>
      </div>

      <div className="form-group">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={options.showFaceitLevel}
            onChange={(e) => update({ showFaceitLevel: e.target.checked })}
          />
          Show FACEIT level
        </label>
      </div>

      <div className="form-group">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={options.showMembership}
            onChange={(e) => update({ showMembership: e.target.checked })}
          />
          Show membership
        </label>
      </div>

      <div className="form-group">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={options.showTechnicalIds}
            onChange={(e) => update({ showTechnicalIds: e.target.checked })}
          />
          Show technical identifiers (SteamID64, FACEIT ID)
        </label>
      </div>

      <div className="actions">
        <button onClick={save}>Save</button>
        <button onClick={testKey} disabled={testing} className="secondary">
          {testing ? "Testing..." : "Test key"}
        </button>
      </div>

      {status && (
        <div className={`status ${status.type}`}>{status.text}</div>
      )}
    </div>
  );
};

// Mount
const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(React.createElement(Options));
}
