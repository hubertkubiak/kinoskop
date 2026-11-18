// Tree-shaken ECharts build: only the charts and components Kinoskop uses (SPEC §2.2).
import { BarChart, HeatmapChart, LineChart, MapChart, ScatterChart, TreemapChart, GraphChart, CustomChart } from 'echarts/charts';
import {
  DataZoomComponent,
  GeoComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
  AriaComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  BarChart,
  LineChart,
  ScatterChart,
  TreemapChart,
  HeatmapChart,
  MapChart,
  GraphChart,
  CustomChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  DataZoomComponent,
  GeoComponent,
  MarkLineComponent,
  AriaComponent,
  CanvasRenderer,
]);

export { echarts };
