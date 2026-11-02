// How a selected step looks, shared by the Steps list rows and the step flow graph nodes so the two
// read as the same selection: a blue tint and a strong blue border.
// The extra ring is a box-shadow, so the border gets thicker without shifting the layout.
export const SELECTED_STEP_STYLE = {
  borderColor: "#2563eb",
  backgroundColor: "#dbeafe",
  boxShadow: "0 0 0 2px #2563eb",
} as const;
