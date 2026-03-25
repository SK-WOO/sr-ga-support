import styles from "./Modal.module.css";

export default function Modal({ title, onClose, children, width = 520 }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.box} style={{ maxWidth: width }}>
        <div className={styles.header}>
          <strong className={styles.title}>{title}</strong>
          <button onClick={onClose} className={styles.closeBtn}>×</button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
