"use client";

import { useEffect, useMemo } from "react";
import { Paper, Typography } from "@mui/material";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useReactFlow,
  useStore,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import type { Alert, AlertTransition } from "@/lib/actions";
import { getStepDepths, orderStepsByFlow } from "@/lib/playbookFlow";
import { formatAlertLabel, formatTimeAgo, getStepStatus, STEP_STATUS_LABELS, type StepStatus } from "@/lib/stockUtils";

import { SELECTED_STEP_STYLE } from "./stepSelection";

import "@xyflow/react/dist/style.css";

type StepNodeData = {
  number: number;
  label: string;
  status: StepStatus;
  detail: string | null;
  selected: boolean;
};

type StepNode = Node<StepNodeData, "step">;

const NODE_WIDTH = 210;
// Wide enough between columns for the "why" label on the links; longer labels are shortened.
const COLUMN_GAP = 200;
const MAX_LABEL_LENGTH = 30;

function shortLabel(text: string | null | undefined) {
  if (!text) return undefined;
  return text.length > MAX_LABEL_LENGTH ? `${text.slice(0, MAX_LABEL_LENGTH - 1).trimEnd()}…` : text;
}
const ROW_HEIGHT = 110;

// Same colours as the step status chips: grey waiting, blue watching, green done.
const STATUS_COLORS: Record<StepStatus, string> = {
  waiting: "#a1a1aa",
  watching: "#3b82f6",
  done: "#10b981",
};

// Graph height follows the tallest column, kept compact so the price chart fits below it.
function graphHeight(tallestColumn: number) {
  return Math.min(320, Math.max(180, tallestColumn * ROW_HEIGHT + 60));
}

// Flows left to right: one column per flow depth (first steps on the left), and steps at the
// same depth stacked in their column, centered.
function buildGraph(
  alerts: Alert[],
  transitions: AlertTransition[],
): { nodes: StepNode[]; edges: Edge[]; tallestColumn: number } {
  const depths = getStepDepths(alerts, transitions);
  const numbers = new Map(orderStepsByFlow(alerts, transitions).map((alert, index) => [alert.id, index + 1]));
  const statuses = new Map(alerts.map((alert) => [alert.id, getStepStatus(alert)]));
  const columns = new Map<number, Alert[]>();
  for (const alert of [...alerts].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const depth = depths.get(alert.id)!;
    columns.set(depth, [...(columns.get(depth) ?? []), alert]);
  }

  const nodes: StepNode[] = [...columns].flatMap(([depth, column]) =>
    column.map((alert, index) => ({
      id: String(alert.id),
      type: "step",
      position: {
        x: depth * (NODE_WIDTH + COLUMN_GAP),
        y: (index - (column.length - 1) / 2) * ROW_HEIGHT,
      },
      data: {
        number: numbers.get(alert.id)!,
        label: formatAlertLabel(alert),
        status: statuses.get(alert.id)!,
        detail: alert.triggered_at ? `Fired ${formatTimeAgo(alert.triggered_at)}` : alert.description || null,
        selected: false,
      },
    })),
  );

  const edges: Edge[] = transitions
    .filter((t) => depths.has(t.source_alert_id) && depths.has(t.target_alert_id))
    .map((transition) => {
      // Green once the step before has fired, so the path already taken stands out.
      const color = statuses.get(transition.source_alert_id) === "done" ? STATUS_COLORS.done : "#71717a";
      return {
        id: `t-${transition.id}`,
        source: String(transition.source_alert_id),
        target: String(transition.target_alert_id),
        type: "smoothstep",
        label: shortLabel(transition.explanation),
        labelStyle: { fontSize: 12, fill: "#3f3f46" },
        labelBgStyle: { fill: "#ffffff", fillOpacity: 0.95 },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 4,
        style: { stroke: color, strokeWidth: 1.75 },
        markerEnd: { type: MarkerType.ArrowClosed, color },
      };
    });

  const tallestColumn = Math.max(0, ...[...columns.values()].map((column) => column.length));
  return { nodes, edges, tallestColumn };
}

// Handles only anchor the edges; they're hidden since nothing can be connected here.
const hiddenHandle = { opacity: 0, pointerEvents: "none" } as const;

function StepCardNode({ data }: NodeProps<StepNode>) {
  const edgeColor = data.selected ? SELECTED_STEP_STYLE.borderColor : "#e4e4e7";
  return (
    <div
      className="cursor-pointer rounded-lg border bg-white py-2 pl-3 pr-3 shadow-sm transition-shadow hover:shadow-md"
      style={{
        width: NODE_WIDTH,
        // Each side's colour is set on its own (no borderColor shorthand), so the status stripe on
        // the left can differ from the selection border without React style warnings.
        borderTopColor: edgeColor,
        borderRightColor: edgeColor,
        borderBottomColor: edgeColor,
        borderLeftColor: STATUS_COLORS[data.status],
        borderLeftWidth: 4,
        backgroundColor: data.selected ? SELECTED_STEP_STYLE.backgroundColor : undefined,
        boxShadow: data.selected ? SELECTED_STEP_STYLE.boxShadow : undefined,
      }}
      title={data.selected ? "Selected — click to clear" : "Select this step"}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} style={hiddenHandle} />
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>Step {data.number}</span>
        <span className="font-medium" style={{ color: STATUS_COLORS[data.status] }}>
          {STEP_STATUS_LABELS[data.status]}
        </span>
      </div>
      <p className="mt-0.5 truncate text-base font-semibold text-zinc-900 dark:text-zinc-100">{data.label}</p>
      {data.detail && <p className="truncate text-xs text-zinc-500">{data.detail}</p>}
      <Handle type="source" position={Position.Right} isConnectable={false} style={hiddenHandle} />
    </div>
  );
}

const nodeTypes = { step: StepCardNode };

// Fit everything, but never blow a few steps up past their natural size.
const FIT_VIEW_OPTIONS = { padding: 0.15, maxZoom: 1 };

// fitView only runs on mount, so re-fit when the graph's width changes (window or layout resize).
function FitViewOnResize() {
  const { fitView } = useReactFlow();
  const width = useStore((state) => state.width);
  useEffect(() => {
    if (width > 0) fitView(FIT_VIEW_OPTIONS);
  }, [width, fitView]);
  return null;
}

// Read-only map of a playbook's steps; steps are edited in the Steps list. The selected step is
// highlighted, and clicking a step selects it, the same as clicking it in the list.
export default function StepFlowGraph({
  alerts,
  transitions = [],
  selectedStepId,
  onSelectStep,
}: {
  alerts: Alert[];
  transitions?: AlertTransition[];
  selectedStepId: number | null;
  onSelectStep: (stepId: number) => void;
}) {
  const graph = useMemo(() => buildGraph(alerts, transitions), [alerts, transitions]);
  const { edges, tallestColumn } = graph;
  // Only the highlight changes on selection, so the layout (and the view's zoom) stays put.
  const nodes = useMemo(
    () =>
      graph.nodes.map((node) => ({ ...node, data: { ...node.data, selected: node.id === String(selectedStepId) } })),
    [graph.nodes, selectedStepId],
  );
  // Remount when the steps or links change, so the view re-fits to the new graph.
  const layoutKey = `${nodes.map((node) => node.id).join(",")}|${edges.map((edge) => edge.id).join(",")}`;

  return (
    <Paper component="section" elevation={1} sx={{ p: 2 }}>
      <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mr: "auto" }}>
          Step flow
        </Typography>
        {(Object.keys(STATUS_COLORS) as StepStatus[]).map((status) => (
          <span key={status} className="flex items-center gap-1 text-xs text-zinc-600">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STATUS_COLORS[status] }} />
            {STEP_STATUS_LABELS[status]}
          </span>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border" style={{ height: graphHeight(tallestColumn) }}>
        {nodes.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-zinc-500">
            Add steps to this playbook to see how they connect.
          </div>
        ) : (
          <ReactFlow
            key={layoutKey}
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            deleteKeyCode={null}
            onNodeClick={(_event, node) => onSelectStep(Number(node.id))}
            fitView
            fitViewOptions={FIT_VIEW_OPTIONS}
            minZoom={0.3}
            maxZoom={1.75}
            // Let the page scroll over the graph; zoom with the controls, a pinch or ctrl+wheel.
            zoomOnScroll={false}
            preventScrolling={false}
            zoomOnDoubleClick={false}
          >
            <Background gap={20} size={1} />
            <Controls showInteractive={false} position="bottom-right" fitViewOptions={FIT_VIEW_OPTIONS} />
            <FitViewOnResize />
          </ReactFlow>
        )}
      </div>
    </Paper>
  );
}
