// How a playbook's steps connect: each transition says "when source fires, target starts".

type FlowEdge = { source_alert_id: number; target_alert_id: number };
type FlowStep = { id: number; created_at: string };

// Depth of each step: 0 for steps nothing leads into, otherwise one more than the deepest step leading
// into it. Capped at the number of steps, so a cycle can't loop forever.
export function getStepDepths(steps: FlowStep[], edges: FlowEdge[]): Map<number, number> {
  const depths = new Map(steps.map((step) => [step.id, 0]));
  for (let pass = 0; pass < steps.length; pass++) {
    let changed = false;
    for (const edge of edges) {
      const sourceDepth = depths.get(edge.source_alert_id);
      const targetDepth = depths.get(edge.target_alert_id);
      if (sourceDepth == null || targetDepth == null) continue;
      if (targetDepth < sourceDepth + 1 && sourceDepth + 1 <= steps.length) {
        depths.set(edge.target_alert_id, sourceDepth + 1);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return depths;
}

// Steps in the order they run: by depth, then by when they were created.
export function orderStepsByFlow<T extends FlowStep>(steps: T[], edges: FlowEdge[]): T[] {
  const depths = getStepDepths(steps, edges);
  return [...steps].sort(
    (a, b) => depths.get(a.id)! - depths.get(b.id)! || a.created_at.localeCompare(b.created_at),
  );
}

// The step and every step that (directly or indirectly) starts after it.
export function getStepWithDescendants(stepId: number, edges: FlowEdge[]): Set<number> {
  const found = new Set([stepId]);
  const queue = [stepId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of edges) {
      if (edge.source_alert_id === current && !found.has(edge.target_alert_id)) {
        found.add(edge.target_alert_id);
        queue.push(edge.target_alert_id);
      }
    }
  }
  return found;
}
