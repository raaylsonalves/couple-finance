interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  total: number;
  monthYear: string;
}

export function DonutChart({ segments, total, monthYear }: DonutChartProps) {
  const size = 200;
  const radius = 80;
  const strokeWidth = 28;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;

  if (total === 0) {
    return (
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={normalizedRadius}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth={strokeWidth}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-xs text-gray-400">{monthYear}</p>
            <p className="text-lg font-bold text-gray-900">R$ 0,00</p>
            <p className="text-[10px] text-gray-400">Despesas Totais</p>
          </div>
        </div>
      </div>
    );
  }

  let currentOffset = 0;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        {segments.map((seg) => {
          const segLength = (seg.value / total) * circumference;
          const dasharray = Math.max(segLength, 1) + ' ' + (circumference - Math.max(segLength, 1));
          const dashoffset = -currentOffset;
          currentOffset += segLength;
          const rotate = 'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')';
          return (
            <circle
              key={seg.label}
              cx={size / 2}
              cy={size / 2}
              r={normalizedRadius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={dasharray}
              strokeDashoffset={dashoffset}
              transform={rotate}
              className="transition-all duration-500"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xs text-gray-400">{monthYear}</p>
          <p className="text-lg font-bold text-gray-900">
            R$ {total.toFixed(2).replace('.', ',')}
          </p>
          <p className="text-[10px] text-gray-400">Despesas Totais</p>
        </div>
      </div>
    </div>
  );
}
