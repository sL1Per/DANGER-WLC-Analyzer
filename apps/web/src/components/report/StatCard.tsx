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
  onTitleClick?: () => void;
  rows: StatCardRow[];
}

export function StatCard({ title, titleStyle, titleClassName, onTitleClick, rows }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className={`stat-card__title ${titleClassName ?? ""}`} style={titleStyle}>
        {onTitleClick ? (
          <button type="button" className="player-link" onClick={onTitleClick}>{title}</button>
        ) : (
          title
        )}
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
