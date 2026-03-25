import React, { Component } from "react";
import styles from "./ErrorBoundary.module.css";

export default class ErrorBoundary extends Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { console.error("ErrorBoundary caught:", error, info); }

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.wrap}>
          <div className={styles.icon}>⚠️</div>
          <div className={styles.title}>문제가 발생했습니다.</div>
          <div className={styles.desc}>새로고침하면 대부분 해결됩니다.</div>
          <button className={styles.btn} onClick={() => window.location.reload()}>새로고침</button>
        </div>
      );
    }
    return this.props.children;
  }
}
