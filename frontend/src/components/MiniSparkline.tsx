import React from "react";
import { View } from "react-native";
import Svg, { Polyline, Circle, Defs, LinearGradient, Stop, Polygon } from "react-native-svg";
import { terminalColors } from "@/theme/terminalTheme";

interface MiniSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export const MiniSparkline: React.FC<MiniSparklineProps> = ({
  data,
  width = 84,
  height = 28,
  color,
}) => {
  if (!data || data.length < 2) {
    return <View style={{ width, height }} />;
  }

  const isUp = data[data.length - 1] >= data[0];
  const strokeColor = color || (isUp ? terminalColors.bullish : terminalColors.bearish);

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((val, idx) => {
    const x = Math.round((idx / (data.length - 1)) * (width - 4)) + 2;
    const y = Math.round(height - 4 - ((val - min) / range) * (height - 8));
    return `${x},${y}`;
  });

  const pointsString = points.join(" ");
  const lastPoint = points[points.length - 1].split(",");
  const lastX = parseFloat(lastPoint[0]);
  const lastY = parseFloat(lastPoint[1]);

  // Polygon area for subtle gradient fill
  const areaPoints = `2,${height} ${pointsString} ${width - 2},${height}`;

  return (
    <View style={{ width, height, overflow: "hidden" }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id={`grad-${isUp ? "up" : "down"}`} x1="0" y1="0" x2="0" y2="1">
            <Stop
              offset="0"
              stopColor={strokeColor}
              stopOpacity="0.25"
            />
            <Stop
              offset="1"
              stopColor={strokeColor}
              stopOpacity="0.0"
            />
          </LinearGradient>
        </Defs>

        <Polygon
          points={areaPoints}
          fill={`url(#grad-${isUp ? "up" : "down"})`}
        />

        <Polyline
          points={pointsString}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <Circle
          cx={lastX}
          cy={lastY}
          r="2.5"
          fill={strokeColor}
        />
      </Svg>
    </View>
  );
};
