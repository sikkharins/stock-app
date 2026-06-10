interface SparklineProps {
  points: number[];
  color?: string;
  width?: number;
  height?: number;
  animate?: boolean;
  fill?: boolean;
}

let GID = 0;
const nextId = () => "spark-grad-" + (++GID);

export default function Sparkline({
  points,
  color = "var(--blue)",
  width = 60,
  height = 24,
  animate = true,
  fill = true,
}: SparklineProps) {
  if (points.length === 0) {
    return <svg width={width} height={height} aria-hidden="true" />;
  }

  const padded = points.length === 1 ? [points[0], points[0]] : points;
  const min = Math.min(...padded);
  const max = Math.max(...padded);
  const range = max - min || 1;
  const stepX = width / (padded.length - 1);

  const coords = padded.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const polyPoints = coords.join(" ");
  // Area polygon: line points + baseline at height back to start
  const areaPoints = polyPoints + ` ${width.toFixed(2)},${height} 0,${height}`;
  const pathLen = padded.length * stepX;
  const gradId = nextId();

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      style={{ overflow: "visible", display: "block" }}
    >
      {fill && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.55" />
            <stop offset="60%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {fill && (
        <polygon
          points={areaPoints}
          fill={`url(#${gradId})`}
          style={
            animate
              ? {
                  opacity: 0,
                  animation: "spark-fade 800ms var(--ease-out, ease-out) 100ms forwards",
                }
              : undefined
          }
        />
      )}
      <polyline
        points={polyPoints}
        fill="none"
        stroke={color}
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={
          animate
            ? {
                strokeDasharray: pathLen,
                strokeDashoffset: pathLen,
                animation: "spark-draw 900ms var(--ease-out, ease-out) forwards",
                filter: `drop-shadow(0 0 3px ${color})`,
              }
            : { filter: `drop-shadow(0 0 3px ${color})` }
        }
      />
      <style>{`
        @keyframes spark-draw { to { stroke-dashoffset: 0; } }
        @keyframes spark-fade { to { opacity: 1; } }
      `}</style>
    </svg>
  );
}
