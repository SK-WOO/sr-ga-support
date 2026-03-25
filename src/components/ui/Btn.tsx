import styles from "./Btn.module.css";

export default function Btn({ onClick, children, variant = "primary", disabled = false, style = {} }) {
  const varClass = styles[variant] || styles.primary;
  return (
    <button onClick={onClick} disabled={disabled}
      className={`${styles.btn} ${varClass}`}
      style={style}>
      {children}
    </button>
  );
}
