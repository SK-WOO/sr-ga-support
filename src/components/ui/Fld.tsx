import React from "react";
import { C } from "../../constants";
import styles from "./Fld.module.css";

// Phase 1-2: inputStyle은 동적 스타일이 필요한 곳에서 여전히 사용
export const inputStyle: React.CSSProperties = {
  width: "100%", border: `1px solid ${C.border}`, borderRadius: 6,
  padding: "8px 10px", fontSize: 13, boxSizing: "border-box", background: "#fff",
};

export function Fld({ label, required = false, children, error = undefined }) {
  return (
    <div className={styles.field}>
      {label && (
        <label className={styles.label}>
          {label}{required && <span className={styles.required}> *</span>}
        </label>
      )}
      {children}
      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
}

export function Inp({ value, onChange, placeholder = "", type = "text", style = {}, maxLength = undefined, onBlur = undefined }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      type={type} maxLength={maxLength} onBlur={onBlur}
      className={styles.input} style={style} />
  );
}

export function Sel({ value, onChange, options, placeholder = undefined, onBlur = undefined, style = {} }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} onBlur={onBlur}
      className={styles.input} style={style}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
    </select>
  );
}

export function Txa({ value, onChange, placeholder, rows = 3, maxLength = undefined, onBlur = undefined, style = {} }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      rows={rows} maxLength={maxLength} onBlur={onBlur}
      className={styles.input} style={{ resize: "vertical", ...style }} />
  );
}
