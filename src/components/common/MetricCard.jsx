export function MetricCard({ label, value, detail, accent = false }) {
  return (
    <div className={`metric-card${accent ? " metric-card--accent" : ""}`}>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      <span className="metric-detail">{detail}</span>
    </div>
  );
}
