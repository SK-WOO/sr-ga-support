import { useEffect } from "react";
import { C } from "../../constants";
import styles from "./Toast.module.css";

export default function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  const bg    = type === "error" ? C.dangerLight  : type === "success" ? C.successLight : "#f0f9ff";
  const color = type === "error" ? C.danger       : type === "success" ? C.success      : C.primary;
  return (
    <div className={styles.toast} style={{ background: bg, color, border: `1px solid ${color}` }}>
      <span className={styles.msg}>{msg}</span>
      <button onClick={onClose} className={styles.closeBtn} style={{ color }}>×</button>
    </div>
  );
}
