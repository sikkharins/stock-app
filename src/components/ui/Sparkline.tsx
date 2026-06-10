interface SparklineProps {
  points: number[];
  color?: string;
  width?: number;
  height?: number;
  animate?: boolean;
}

export default function Sparkline({
  points,
  color = "var(--blue)",
  width = 60,
  height = 24,
  animate = true,
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
  const pathLen = padded.length * stepX;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      style={{ overflow: "visible", display: "block" }}
    >
      <polyline
        points={polyPoints}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={
          animate
            ? {
                strokeDasharray: pathLen,
                strokeDashoffset: pathLen,
                animation: "spark-draw 600ms var(--ease-out, ease-out) forwards",
              }
            : undefined
        }
      />
      <style>{`@keyframes spark-draw { to { stroke-dashoffset: 0; } }`}</style>
    </svg>
  );
}
