import type { CSSProperties, ReactNode } from "react";

export interface StatCardRow {
  label: ReactNode;
  value: ReactNode;
  className?: string;
}

export interface StatCardProps {
  title: ReactNode;
  titleStyle?: CSSProperties;
  titleClassName?: string;
  rows: StatCardRow[];
}

export function StatCard({ title, titleStyle, titleClassName, rows }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className={`stat-card__title ${titleClassName ?? ""}`} style={titleStyle}>
        {title}
      </div>
      <dl className="stat-card__rows">
        {rows.map((r, i) => (
          <div key={i} className={`stat-card__row ${r.className ?? ""}`}>
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function StatCards({ children }: { children: ReactNode }) {
  return <div className="stat-cards">{children}</div>;
}
