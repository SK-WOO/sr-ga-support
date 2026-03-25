import { REQ_TYPES } from "../constants";
import Badge from "./ui/Badge";
import styles from "./ReqCard.module.css";

export default function ReqCard({ req, roster, onClick }) {
  const t         = REQ_TYPES[req.type] || {};
  const applicant = roster.find(r => String(r.id) === String(req.applicantId));
  return (
    <div onClick={onClick} className={styles.card}>
      <span className={styles.icon}>{t.icon || "📋"}</span>
      <div className={styles.info}>
        <div className={styles.title}>{req.title}</div>
        <div className={styles.meta}>
          {t.label}{applicant && applicant.email !== req.applicantEmail ? ` · ${applicant.name}` : ""}
          {" · "}{req.submittedAt ? new Date(req.submittedAt).toLocaleDateString() : ""}
        </div>
      </div>
      <Badge status={req.status} />
    </div>
  );
}
