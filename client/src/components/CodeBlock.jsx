import { useState } from "react";
import { CopyIcon, CheckIcon } from "./Icons";

export default function CodeBlock({ language, value }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code", err);
    }
  };

  return (
    <div className="code-block-container">
      <div className="code-block-header">
        <span className="code-lang-tag">{language || "code"}</span>
        <button
          type="button"
          className={`copy-code-btn ${copied ? "copied" : ""}`}
          onClick={handleCopy}
          aria-label="Copy code to clipboard"
        >
          {copied ? (
            <>
              <CheckIcon size={13} />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <CopyIcon size={13} />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>
      <div className="code-block-body">
        <pre>
          <code>{value}</code>
        </pre>
      </div>
    </div>
  );
}

