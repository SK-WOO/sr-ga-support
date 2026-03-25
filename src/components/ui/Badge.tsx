import { STATUS } from "../../constants";
import styles from "./Badge.module.css";

export default function Badge({ status }) {
  const s = STATUS[status] || STATUS.pending;
  return (
    <span className={styles.badge} style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}
