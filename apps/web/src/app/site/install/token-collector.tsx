"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

const STORAGE_KEY = "project1-install-tokens";

type Tokens = Record<string, string>;

const TokenCtx = createContext<{
  tokens: Tokens;
  update: (key: string, value: string) => void;
  hydrated: boolean;
}>({ tokens: {}, update: () => {}, hydrated: false });

export function TokenProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<Tokens>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Support both old format (plain object) and new format (with expiry)
        if (parsed.expires && parsed.data) {
          if (Date.now() < parsed.expires) {
            setTokens(parsed.data);
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        } else {
          // Old format — migrate it
          setTokens(parsed);
        }
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const wrapper = {
        data: tokens,
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(wrapper));
    } catch {}
  }, [tokens, hydrated]);

  const update = useCallback((key: string, value: string) => {
    setTokens((prev) => ({ ...prev, [key]: value }));
  }, []);

  return (
    <TokenCtx.Provider value={{ tokens, update, hydrated }}>
      {children}
    </TokenCtx.Provider>
  );
}

const VALIDATORS: Record<string, (v: string) => string | null> = {
  telegram_bot_token: (v) => /^\d+:[A-Za-z0-9_-]{30,}$/.test(v) ? null : "Should look like 7123456789:AAF-abc123...",
  slack_bot_token: (v) => v.startsWith("xoxb-") ? null : "Should start with xoxb-",
  slack_app_token: (v) => v.startsWith("xapp-") ? null : "Should start with xapp-",
  slack_user_id: (v) => /^U[A-Z0-9]{8,}$/.test(v) ? null : "Should start with U followed by letters/numbers",
  groq_api_key: (v) => v.startsWith("gsk_") ? null : "Should start with gsk_",
  elevenlabs_api_key: (v) => v.startsWith("sk_") ? null : "Should start with sk_",
  gemini_api_key: (v) => v.startsWith("AIza") ? null : "Should start with AIza",
  perplexity_api_key: (v) => v.startsWith("pplx-") ? null : "Should start with pplx-",
  ghl_private_integration_token: (v) => v.startsWith("pit-") ? null : "Should start with pit-",
  ghl_location_id: (v) => /^[a-zA-Z0-9]{5,}$/.test(v) ? null : "Should be the alphanumeric ID from your GHL URL",
  apify_token: (v) => v.startsWith("apify_api_") ? null : "Should start with apify_api_",
};

export function TokenField({ id, label, placeholder }: { id: string; label: string; placeholder: string }) {
  const { tokens, update, hydrated } = useContext(TokenCtx);
  const value = hydrated ? tokens[id] || "" : "";
  const validate = VALIDATORS[id];
  const error = value && validate ? validate(value) : null;

  return (
    <div className="mt-4">
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => update(id, e.target.value.trim())}
        placeholder={placeholder}
        className={`w-full px-4 py-2.5 rounded-lg border bg-white text-sm font-mono placeholder:text-[var(--color-charcoal)]/25 focus:outline-none focus:ring-1 transition-colors ${
          error
            ? "border-red-400 focus:border-red-400 focus:ring-red-200"
            : value && !error
              ? "border-green-400 focus:border-green-400 focus:ring-green-200"
              : "border-[var(--color-charcoal)]/10 focus:border-[var(--color-orange)]/40 focus:ring-[var(--color-orange)]/20"
        }`}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

// Map website field IDs → .env variable names
const FIELD_TO_ENV: Record<string, string> = {
  telegram_bot_token: "TELEGRAM_BOT_TOKEN",
  slack_bot_token: "SLACK_BOT_TOKEN",
  slack_app_token: "SLACK_APP_TOKEN",
  slack_user_id: "ALLOWED_SLACK_USER_ID",
  groq_api_key: "GROQ_API_KEY",
  elevenlabs_api_key: "ELEVENLABS_API_KEY",
  elevenlabs_voice_id: "ELEVENLABS_VOICE_ID",
  gemini_api_key: "GEMINI_API_KEY",
  perplexity_api_key: "PERPLEXITY_API_KEY",
  ghl_private_integration_token: "GHL_PRIVATE_INTEGRATION_TOKEN",
  ghl_location_id: "GHL_LOCATION_ID",
  apify_token: "APIFY_TOKEN",
};

const ALL_FIELD_IDS = Object.keys(FIELD_TO_ENV);

const SUMMARY_FIELDS = [
  { id: "telegram_bot_token", label: "Telegram Bot Token", group: "Telegram" },
  { id: "slack_bot_token", label: "Bot Token", group: "Slack" },
  { id: "slack_app_token", label: "App Token", group: "Slack" },
  { id: "slack_user_id", label: "User ID", group: "Slack" },
  { id: "groq_api_key", label: "Groq API Key", group: "Voice" },
  { id: "elevenlabs_api_key", label: "ElevenLabs Key", group: "Voice" },
  { id: "elevenlabs_voice_id", label: "Voice ID", group: "Voice" },
  { id: "gemini_api_key", label: "Gemini API Key", group: "AI Services" },
  { id: "perplexity_api_key", label: "Perplexity API Key", group: "AI Services" },
  { id: "ghl_private_integration_token", label: "Private Integration Token", group: "GoHighLevel" },
  { id: "ghl_location_id", label: "Location ID", group: "GoHighLevel" },
  { id: "apify_token", label: "API Token", group: "Apify" },
];

export function TokenSummary() {
  const { tokens, hydrated } = useContext(TokenCtx);
  if (!hydrated) return null;

  const groups = ["Telegram", "Slack", "Voice", "AI Services", "GoHighLevel", "Apify"] as const;

  return (
    <div className="space-y-4 mb-8">
      {groups.map((group) => {
        const fields = SUMMARY_FIELDS.filter((f) => f.group === group);
        return (
          <div key={group} className="p-4 rounded-xl bg-white border border-[var(--color-charcoal)]/5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-3">{group}</p>
            <div className="space-y-2">
              {fields.map((f) => {
                const val = tokens[f.id];
                const validate = VALIDATORS[f.id];
                const hasError = val && validate ? validate(val) !== null : false;
                return (
                  <div key={f.id} className="flex items-center justify-between gap-4">
                    <span className="text-sm font-medium">{f.label}</span>
                    {!val ? (
                      <span className="text-xs text-[var(--color-charcoal)]/30">—</span>
                    ) : hasError ? (
                      <span className="text-xs font-mono text-red-500">invalid</span>
                    ) : (
                      <span className="text-xs font-mono text-green-600">
                        {val.length > 20 ? val.slice(0, 8) + "..." + val.slice(-4) : val}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function generateTokensFile(tokens: Tokens): string {
  const lines = ALL_FIELD_IDS
    .filter((id) => tokens[id])
    .map((id) => `${FIELD_TO_ENV[id]}=${tokens[id]}`);
  return "# 0ne Install Tokens\n# Drop this file in your 0ne folder — the installer reads it automatically.\n\n" + lines.join("\n") + "\n";
}

export function TokenDownload() {
  const { tokens, hydrated } = useContext(TokenCtx);

  const filledCount = ALL_FIELD_IDS.filter((id) => tokens[id]).length;
  const totalCount = ALL_FIELD_IDS.length;

  function handleDownload() {
    if (filledCount === 0) return;
    const content = generateTokensFile(tokens);
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "0ne-tokens.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleClear() {
    if (!window.confirm("Clear all saved tokens?")) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    window.location.reload();
  }

  if (!hydrated) return null;

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={handleDownload}
        disabled={filledCount === 0}
        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[var(--color-charcoal)] rounded-lg hover:bg-[var(--color-charcoal)]/80 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 1v10m0 0L4.5 7.5M8 11l3.5-3.5M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Save Credentials ({filledCount}/{totalCount})
      </button>

      {filledCount > 0 && (
        <button
          onClick={handleClear}
          className="text-sm text-[var(--color-muted)] hover:text-[var(--color-charcoal)] transition-colors cursor-pointer"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

const ONE_TOKEN_KEY = "project1-one-token";

export function OneDownloadSection() {
  const { tokens, hydrated } = useContext(TokenCtx);
  const [oneToken, setOneToken] = useState("");
  const [status, setStatus] = useState<"idle" | "downloading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(ONE_TOKEN_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Support both old format (plain string) and new format (with expiry)
        if (parsed && typeof parsed === "object" && parsed.expires && parsed.data) {
          if (Date.now() < parsed.expires) {
            setOneToken(parsed.data);
          } else {
            localStorage.removeItem(ONE_TOKEN_KEY);
          }
        } else {
          // Old format — was stored as a plain string
          setOneToken(stored);
        }
      }
    } catch {
      // JSON.parse failed — old format was a plain string
      try {
        const stored = localStorage.getItem(ONE_TOKEN_KEY);
        if (stored) setOneToken(stored);
      } catch {}
    }
  }, []);

  useEffect(() => {
    try {
      const wrapper = {
        data: oneToken,
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      };
      localStorage.setItem(ONE_TOKEN_KEY, JSON.stringify(wrapper));
    } catch {}
  }, [oneToken]);

  const filledCount = ALL_FIELD_IDS.filter((id) => tokens[id]).length;

  async function handleDownloadOne() {
    if (!oneToken) return;
    setStatus("downloading");
    setErrorMsg("");

    try {
      const res = await fetch(`/api/download?token=${encodeURIComponent(oneToken)}`);
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(res.status === 404 ? "Invalid token" : "Download unavailable");
        return;
      }

      const zipBlob = await res.blob();
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(zipBlob);

      if (filledCount > 0) {
        const tokensContent = generateTokensFile(tokens);
        zip.file("0ne-tokens.txt", tokensContent);
      }

      const modifiedZip = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(modifiedZip);
      const a = document.createElement("a");
      a.href = url;
      a.download = "0ne.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus("done");
    } catch {
      setStatus("error");
      setErrorMsg("Download failed — try again");
    }
  }

  if (!hydrated) return null;

  return (
    <div className="mt-10 p-6 rounded-xl border-2 border-[var(--color-orange)]/20 bg-[var(--color-orange)]/5">
      <h3 className="font-bold text-lg mb-2">Download 0ne</h3>
      <p className="text-sm text-[var(--color-muted)] mb-4">
        Enter the token your administrator gave you to download 0ne with all your credentials pre-loaded.
      </p>
      <label className="block text-sm font-medium mb-1.5">0ne Token</label>
      <input
        type="text"
        value={oneToken}
        onChange={(e) => { setOneToken(e.target.value.trim()); setStatus("idle"); }}
        placeholder="Your download token"
        className={`w-full px-4 py-2.5 rounded-lg border bg-white text-sm font-mono placeholder:text-[var(--color-charcoal)]/25 focus:outline-none focus:ring-1 transition-colors mb-4 ${
          status === "error"
            ? "border-red-400 focus:border-red-400 focus:ring-red-200"
            : status === "done"
              ? "border-green-400 focus:border-green-400 focus:ring-green-200"
              : "border-[var(--color-charcoal)]/10 focus:border-[var(--color-orange)]/40 focus:ring-[var(--color-orange)]/20"
        }`}
      />
      {status === "error" && errorMsg && (
        <p className="text-xs text-red-500 mb-3 -mt-2">{errorMsg}</p>
      )}
      <button
        onClick={handleDownloadOne}
        disabled={!oneToken || status === "downloading"}
        className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-[var(--color-orange)] rounded-lg hover:bg-[var(--color-orange-dark)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {status === "downloading" ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Preparing...
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 1v10m0 0L4.5 7.5M8 11l3.5-3.5M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Download 0ne{filledCount > 0 ? ` (with ${filledCount} credentials)` : ""}
          </>
        )}
      </button>
      {status === "done" && (
        <p className="text-sm text-green-600 mt-3 font-medium">
          Download started — unzip and double-click &quot;Install on Mac.command&quot; to begin.
        </p>
      )}
    </div>
  );
}
