"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
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

import "@xyflow/react/dist/style.css";

type StepNodeData = {
  number: number;
  label: string;
  status: StepStatus;
  detail: string | null;
};

type StepNode = Node<StepNodeData, "step">;

const NODE_WIDTH = 210;
const COLUMN_GAP = 48;
const ROW_HEIGHT = 130;

// Same colours as the step status chips: grey waiting, blue watching, green done.
const STATUS_COLORS: Record<StepStatus, string> = {
  waiting: "#a1a1aa",
  watching: "#3b82f6",
  done: "#10b981",
};

// Graph height follows the number of rows, so a short playbook doesn't float in empty space.
function graphHeight(rowCount: number) {
  return Math.min(720, Math.max(420, rowCount * ROW_HEIGHT + 80));
}

// One row per flow depth (first steps on top), steps at the same depth side by side, centered.
function buildGraph(
  alerts: Alert[],
  transitions: AlertTransition[],
): { nodes: StepNode[]; edges: Edge[]; rowCount: number } {
  const depths = getStepDepths(alerts, transitions);
  const numbers = new Map(orderStepsByFlow(alerts, transitions).map((alert, index) => [alert.id, index + 1]));
  const statuses = new Map(alerts.map((alert) => [alert.id, getStepStatus(alert)]));
  const rows = new Map<number, Alert[]>();
  for (const alert of [...alerts].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const depth = depths.get(alert.id)!;
    rows.set(depth, [...(rows.get(depth) ?? []), alert]);
  }

  const nodes: StepNode[] = [...rows].flatMap(([depth, row]) =>
    row.map((alert, index) => ({
      id: String(alert.id),
      type: "step",
      position: {
        x: (index - (row.length - 1) / 2) * (NODE_WIDTH + COLUMN_GAP),
        y: depth * ROW_HEIGHT,
      },
      data: {
        number: numbers.get(alert.id)!,
        label: formatAlertLabel(alert),
        status: statuses.get(alert.id)!,
        detail: alert.triggered_at ? `Fired ${formatTimeAgo(alert.triggered_at)}` : alert.description || null,
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
        label: transition.explanation ?? undefined,
        labelStyle: { fontSize: 12, fill: "#3f3f46" },
        labelBgStyle: { fill: "#ffffff", fillOpacity: 0.95 },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 4,
        style: { stroke: color, strokeWidth: 1.75 },
        markerEnd: { type: MarkerType.ArrowClosed, color },
      };
    });

  return { nodes, edges, rowCount: rows.size };
}

// Handles only anchor the edges; they're hidden since nothing can be connected here.
const hiddenHandle = { opacity: 0, pointerEvents: "none" } as const;

function StepCardNode({ data }: NodeProps<StepNode>) {
  return (
    <div
      className="cursor-pointer rounded-lg border border-zinc-200 bg-white py-2 pl-3 pr-3 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900"
      style={{ width: NODE_WIDTH, borderLeft: `4px solid ${STATUS_COLORS[data.status]}` }}
      title="Open this step's chart"
    >
      <Handle type="target" position={Position.Top} isConnectable={false} style={hiddenHandle} />
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>Step {data.number}</span>
        <span className="font-medium" style={{ color: STATUS_COLORS[data.status] }}>
          {STEP_STATUS_LABELS[data.status]}
        </span>
      </div>
      <p className="mt-0.5 truncate text-base font-semibold text-zinc-900 dark:text-zinc-100">{data.label}</p>
      {data.detail && <p className="truncate text-xs text-zinc-500">{data.detail}</p>}
      <Handle type="source" position={Position.Bottom} isConnectable={false} style={hiddenHandle} />
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

// Read-only map of a playbook's steps; steps are edited in the Steps list. Clicking a step opens its page.
export default function StepFlowGraph({
  playbookId,
  alerts,
  transitions = [],
}: {
  playbookId: number;
  alerts: Alert[];
  transitions?: AlertTransition[];
}) {
  const router = useRouter();
  const { nodes, edges, rowCount } = useMemo(() => buildGraph(alerts, transitions), [alerts, transitions]);
  // Remount when the steps or links change, so the view re-fits to the new graph.
  const layoutKey = `${nodes.map((node) => node.id).join(",")}|${edges.map((edge) => edge.id).join(",")}`;

  return (
    <Paper component="section" elevation={1} sx={{ p: 2, position: { lg: "sticky" }, top: { lg: 16 } }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        Step flow
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
        How the steps lead into each other. Click a step to see its chart; zoom with the buttons or a pinch.
      </Typography>
      <div className="mb-1.5 flex flex-wrap gap-3 text-xs text-zinc-600">
        {(Object.keys(STATUS_COLORS) as StepStatus[]).map((status) => (
          <span key={status} className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STATUS_COLORS[status] }} />
            {STEP_STATUS_LABELS[status]}
          </span>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border" style={{ height: graphHeight(rowCount) }}>
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
            onNodeClick={(_event, node) => router.push(`/playbooks/${playbookId}/steps/${node.id}`)}
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
