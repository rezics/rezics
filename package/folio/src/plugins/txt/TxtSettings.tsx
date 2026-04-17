import { useCallback, useMemo, useState } from "react";
import type { PanelProps } from "../../types";
import type { TxtSplitResult } from "./split";

interface TxtSettingsInternalProps extends PanelProps {
  rawText: string;
  currentResult: TxtSplitResult;
  onResplit: (rules: RegExp[]) => TxtSplitResult;
}

export function createTxtSettings(
  rawText: string,
  initialResult: TxtSplitResult,
  onResplit: (rules: RegExp[]) => TxtSplitResult,
) {
  let currentResult = initialResult;

  return function TxtSettings(props: PanelProps) {
    return (
      <TxtSettingsInner
        {...props}
        rawText={rawText}
        currentResult={currentResult}
        onResplit={(rules) => {
          const result = onResplit(rules);
          currentResult = result;
          return result;
        }}
      />
    );
  };
}

function TxtSettingsInner({
  rawText,
  currentResult,
  onResplit,
  requestTreeChange,
}: TxtSettingsInternalProps) {
  const [rules, setRules] = useState<string[]>(() =>
    currentResult.ruleUsed ? [currentResult.ruleUsed.source] : [],
  );
  const [testInput, setTestInput] = useState("");
  const [testError, setTestError] = useState<string | null>(null);
  const [splitInfo, setSplitInfo] = useState({
    count: currentResult.tree.length,
    ruleUsed: currentResult.ruleUsed?.source ?? null,
  });

  // Test preview
  const testPreview = useMemo(() => {
    if (!testInput.trim()) return null;
    try {
      const regex = new RegExp(testInput, "gm");
      const matches: string[] = [];
      let m: RegExpExecArray | null;
      m = regex.exec(rawText);
      while (m !== null) {
        matches.push(m[0].trim());
        if (m.index === regex.lastIndex) regex.lastIndex++;
        if (matches.length >= 5) break;
        m = regex.exec(rawText);
      }
      setTestError(null);
      return {
        count: rawText.match(new RegExp(testInput, "gm"))?.length ?? 0,
        samples: matches,
      };
    } catch (e) {
      setTestError(e instanceof Error ? e.message : "Invalid regex");
      return null;
    }
  }, [testInput, rawText]);

  const addRule = useCallback(() => {
    if (!testInput.trim() || testError) return;
    setRules((prev) => [...prev, testInput]);
    setTestInput("");
  }, [testInput, testError]);

  const removeRule = useCallback((index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleResplit = useCallback(() => {
    try {
      const regexRules = rules.map((r) => new RegExp(r, "gm"));
      const result = onResplit(regexRules);
      setSplitInfo({
        count: result.tree.length,
        ruleUsed: result.ruleUsed?.source ?? null,
      });
      if (requestTreeChange) {
        requestTreeChange(result.tree);
      }
    } catch (_e) {
      // Invalid regex in rules
    }
  }, [rules, onResplit, requestTreeChange]);

  return (
    <div
      className="folio-txt-settings"
      style={{ padding: "12px", fontSize: "13px" }}
    >
      <h4 style={{ margin: "0 0 8px", fontSize: "14px" }}>
        Text Split Settings
      </h4>

      {/* Current rules */}
      <div style={{ marginBottom: "12px" }}>
        <div style={{ fontWeight: 600, marginBottom: "4px" }}>Split Rules</div>
        {rules.length === 0 && (
          <div style={{ color: "#888", fontSize: "12px" }}>
            No custom rules. Using defaults.
          </div>
        )}
        {rules.map((rule, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: static list
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "4px 8px",
              background: "rgba(128, 128, 128, 0.1)",
              borderRadius: "4px",
              marginBottom: "4px",
              fontFamily: "monospace",
              fontSize: "12px",
            }}
          >
            <span
              style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}
            >
              /{rule}/
              {splitInfo.ruleUsed === rule && (
                <span style={{ color: "#22c55e", marginLeft: "4px" }}>★</span>
              )}
            </span>
            <button
              type="button"
              onClick={() => removeRule(i)}
              style={{
                cursor: "pointer",
                fontSize: "12px",
                border: "none",
                background: "none",
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Test input */}
      <div style={{ marginBottom: "12px" }}>
        <div style={{ fontWeight: 600, marginBottom: "4px" }}>Test Regex</div>
        <div style={{ display: "flex", gap: "4px" }}>
          <input
            type="text"
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            placeholder="^Chapter\s+\d+"
            style={{
              flex: 1,
              padding: "6px 8px",
              fontFamily: "monospace",
              fontSize: "12px",
              border: "1px solid rgba(128, 128, 128, 0.3)",
              borderRadius: "4px",
              background: "transparent",
              color: "inherit",
            }}
          />
          <button
            type="button"
            onClick={addRule}
            disabled={!testInput.trim() || !!testError}
            style={{ cursor: "pointer", fontSize: "12px", padding: "6px 12px" }}
          >
            Add
          </button>
        </div>
        {testError && (
          <div style={{ color: "#ef4444", fontSize: "11px", marginTop: "4px" }}>
            {testError}
          </div>
        )}
        {testPreview && (
          <div style={{ fontSize: "12px", marginTop: "4px" }}>
            <span style={{ color: "#22c55e" }}>
              {testPreview.count} matches found
            </span>
            {testPreview.samples.length > 0 && (
              <div
                style={{
                  marginTop: "4px",
                  padding: "4px 8px",
                  background: "rgba(128, 128, 128, 0.1)",
                  borderRadius: "4px",
                  fontFamily: "monospace",
                  fontSize: "11px",
                }}
              >
                {testPreview.samples.map((s, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static list
                  <div key={i}>{s}</div>
                ))}
                {testPreview.count > 5 && <div>...</div>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Result info */}
      <div
        style={{
          padding: "8px",
          background: "rgba(128, 128, 128, 0.05)",
          borderRadius: "4px",
          fontSize: "12px",
          marginBottom: "8px",
        }}
      >
        <div>Chapters: {splitInfo.count}</div>
        {splitInfo.ruleUsed && (
          <div style={{ fontFamily: "monospace" }}>
            Rule: /{splitInfo.ruleUsed}/
          </div>
        )}
        {!splitInfo.ruleUsed && <div>Single chapter (no rule matched)</div>}
      </div>

      {/* Re-split button */}
      <button
        type="button"
        onClick={handleResplit}
        style={{
          width: "100%",
          padding: "8px",
          cursor: "pointer",
          fontSize: "13px",
          borderRadius: "4px",
        }}
      >
        ↻ Re-split with current rules
      </button>
    </div>
  );
}
