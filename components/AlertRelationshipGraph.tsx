"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Paper, Typography } from "@mui/material";
import {
  addEdge,
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type IsValidConnection,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { formatAlertCondition, formatAlertLabel } from "@/lib/stockUtils";

import "@xyflow/react/dist/style.css";

// Minimal shape the graph needs; satisfied by the `Alert` rows from lib/actions.
export type RelatedAlert = {
  id: number;
  stock: string;
  price?: number | null;
  operator?: string | null;
  isActive?: boolean | null;
  created_at: string;
};

// Minimal shape the graph needs; satisfied by the `AlertTransition` rows from lib/actions.
export type AlertTransitionEdge = {
  id: number;
  source_alert_id: number;
  target_alert_id: number;
  condition?: string | null;
  explanation?: string | null;
};

type AlertNodeData = {
  label: string;
  stock: string;
  condition: string;
  isActive: boolean;
  createdAt: string;
};

type AlertNode = Node<AlertNodeData, "alert">;

const NODE_WIDTH = 200;
const ROW_HEIGHT = 150;

// Lays nodes out newest-at-bottom. Edges come from recorded transitions when present,
// otherwise alerts are chained to the one created right before them.
function buildGraph(
  alerts: RelatedAlert[],
  transitions: AlertTransitionEdge[]
): { nodes: AlertNode[]; edges: Edge[] } {
  const ordered = [...alerts].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const nodes: AlertNode[] = ordered.map((alert, index) => ({
    id: String(alert.id),
    type: "alert",
    position: { x: index % 2 === 0 ? 0 : NODE_WIDTH - 40, y: index * ROW_HEIGHT },
    data: {
      label: formatAlertLabel(alert),
      stock: alert.stock,
      condition: formatAlertCondition(alert),
      isActive: alert.isActive !== false,
      createdAt: alert.created_at,
    },
  }));

  const alertIds = new Set(ordered.map((alert) => String(alert.id)));
  const validTransitions = transitions.filter(
    (t) => alertIds.has(String(t.source_alert_id)) && alertIds.has(String(t.target_alert_id))
  );

  const edges: Edge[] =
    validTransitions.length > 0
      ? validTransitions.map((transition) => ({
          id: `t-${transition.id}`,
          source: String(transition.source_alert_id),
          target: String(transition.target_alert_id),
          type: "smoothstep",
          label: transition.condition ?? undefined,
          markerEnd: { type: MarkerType.ArrowClosed },
        }))
      : ordered.slice(1).map((alert, index) => ({
          id: `e-${ordered[index].id}-${alert.id}`,
          source: String(ordered[index].id),
          target: String(alert.id),
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed },
        }));

  return { nodes, edges };
}


function AlertCardNode({ id, data }: NodeProps<AlertNode>) {
  const { updateNodeData } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label);

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next) updateNodeData(id, { label: next });
    else setDraft(data.label);
  }

  return (
    <div
      className="rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
      style={{ width: NODE_WIDTH }}
    >
      <Handle type="target" position={Position.Top} />

      <div className="flex items-center justify-between gap-2">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            data.isActive ? "bg-emerald-500" : "bg-zinc-400"
          }`}
          title={data.isActive ? "Active" : "Inactive"}
        />
        <span className="truncate text-[11px] text-zinc-500">
          {new Date(data.createdAt).toLocaleDateString()}
        </span>
      </div>

      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(data.label);
              setEditing(false);
            }
          }}
          className="mt-1 w-full rounded border px-1 py-0.5 text-sm"
        />
      ) : (
        <p
          className="mt-1 cursor-text truncate text-sm font-medium"
          title="Double-click to rename"
          onDoubleClick={() => {
            setDraft(data.label);
            setEditing(true);
          }}
        >
          {data.label}
        </p>
      )}

      <p className="truncate text-xs text-zinc-500">
        {data.stock} · {data.condition}
      </p>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes = { alert: AlertCardNode };

function AlertRelationshipGraphInner({
  alerts,
  transitions,
}: {
  alerts: RelatedAlert[];
  transitions: AlertTransitionEdge[];
}) {
  const initial = useMemo(() => buildGraph(alerts, transitions), [alerts, transitions]);
  const [nodes, setNodes, onNodesChange] = useNodesState<AlertNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);

  // Only rebuild from props when the linked alerts or transitions actually change,
  // so manual dragging/edits aren't wiped out by unrelated re-renders.
  const signatureRef = useRef(
    `${alerts.map((a) => a.id).sort((a, b) => a - b).join(",")}|${transitions
      .map((t) => t.id)
      .sort((a, b) => a - b)
      .join(",")}`
  );

  useEffect(() => {
    const signature = `${alerts.map((a) => a.id).sort((a, b) => a - b).join(",")}|${transitions
      .map((t) => t.id)
      .sort((a, b) => a - b)
      .join(",")}`;

    if (signature !== signatureRef.current) {
      signatureRef.current = signature;
      const rebuilt = buildGraph(alerts, transitions);
      setNodes(rebuilt.nodes);
      setEdges(rebuilt.edges);
    }
  }, [alerts, transitions, setNodes, setEdges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            id: `e-${connection.source}-${connection.target}-${Date.now()}`,
            type: "smoothstep",
            markerEnd: { type: MarkerType.ArrowClosed },
          },
          current
        )
      );
    },
    [setEdges]
  );

  // Reject self-connections and duplicate relationships (in either direction).
  const isValidConnection: IsValidConnection<Edge> = useCallback(
    (connection) => {
      if (
        !connection.source ||
        !connection.target ||
        connection.source === connection.target
      ) {
        return false;
      }

      return !edges.some(
        (edge) =>
          (edge.source === connection.source && edge.target === connection.target) ||
          (edge.source === connection.target && edge.target === connection.source)
      );
    },
    [edges]
  );

  const resetLayout = useCallback(() => {
    const rebuilt = buildGraph(alerts, transitions);
    setNodes(rebuilt.nodes);
    setEdges(rebuilt.edges);
  }, [alerts, transitions, setNodes, setEdges]);

  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs text-zinc-500">
          Drag between handles to relate alerts. Double-click a node to rename it.
        </p>
        <button
          type="button"
          onClick={resetLayout}
          className="shrink-0 rounded-md border px-2 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          Reset to time order
        </button>
      </div>

      <div className="h-[560px] overflow-hidden rounded-lg border">
        {nodes.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-zinc-500">
            Link alerts to this playbook to see their relationships.
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            nodesDraggable
            nodesConnectable
            elementsSelectable
            deleteKeyCode={["Backspace", "Delete"]}
            fitView
          >
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>
        )}
      </div>
    </>
  );
}

export default function AlertRelationshipGraph({
  alerts,
  transitions = [],
}: {
  alerts: RelatedAlert[];
  transitions?: AlertTransitionEdge[];
}) {
  return (
    <Paper component="section" elevation={1} sx={{ p: 2, position: { lg: "sticky" }, top: { lg: 16 } }}>
      <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
        Alert relationships
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
        {transitions.length > 0
          ? "Edges reflect recorded alert transitions. Drag to rearrange or connect alerts manually."
          : "Alerts are chained in creation order. Drag to rearrange or connect alerts manually."}
      </Typography>

      <ReactFlowProvider>
        <AlertRelationshipGraphInner alerts={alerts} transitions={transitions} />
      </ReactFlowProvider>
    </Paper>
  );
}
