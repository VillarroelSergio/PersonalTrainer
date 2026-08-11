import type { ReactNode } from "react";
import styles from "./ScreenLayout.module.css";

type ScreenLayoutProps = {
  title: string;
  hint?: string;
  children: ReactNode;
};

export function ScreenLayout({ title, hint, children }: ScreenLayoutProps) {
  return (
    <section className={styles.wrap}>
      <h1 className={styles.title}>{title}</h1>
      {hint && <p className={styles.hint}>{hint}</p>}
      <div className={styles.content}>{children}</div>
    </section>
  );
}
