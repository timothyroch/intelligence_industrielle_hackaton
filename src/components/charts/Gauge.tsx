"use client";
import { RadialBar, RadialBarChart, PolarAngleAxis, ResponsiveContainer } from "recharts";

export function Gauge({
  value, max = 100, height = 180, label = "", suffix = "%",
}: { value: number; max?: number; height?: number; label?: string; suffix?: string }) {
  const pct = Math.max(0, Math.min(value, max));
  const data = [{ name: "val", value: pct }];

  return (
    <div className="flex flex-col items-center w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          innerRadius="70%"
          outerRadius="100%"
          data={data}
          startAngle={220}
          endAngle={-40}
        >
          <PolarAngleAxis type="number" domain={[0, max]} tick={false} />
          <RadialBar
            dataKey="value"
            barSize={12}                                    
            cornerRadius={999}
            background={{ fill: "var(--border)" }}         
            fill="var(--primary)"                           
            isAnimationActive
          />
        </RadialBarChart>
      </ResponsiveContainer>

      <div className="pointer-events-none -mt-10 text-center">
        <div className="text-2xl font-semibold tabular-nums">{pct}{suffix}</div>
        {label && <div className="text-xs text-muted-foreground">{label}</div>}
      </div>
    </div>
  );
}
