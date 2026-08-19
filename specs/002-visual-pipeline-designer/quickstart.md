# Quickstart: Visual Pipeline Designer

**Feature**: 002-visual-pipeline-designer  
**Date**: 2026-08-19

## Prerequisites

- Node.js 20 LTS
- pnpm package manager
- EVE Fabric repository cloned and dependencies installed (`pnpm install`)

## Start the Development Environment

1. **Start the gateway** (serves the capability catalog and execution API):

   ```bash
   pnpm --filter gateway dev
   ```

   The gateway starts on port 3456 by default.

2. **Start the designer** (in a second terminal):

   ```bash
   pnpm --filter designer dev
   ```

   The designer starts on port 5173 (Vite default).

3. **Open the designer** in a browser at `http://localhost:5173`.

## Build Your First Pipeline

1. **Browse capabilities**: The left sidebar shows available capabilities grouped by category. Use the search box to find specific capabilities or filter by source type (ESI, SDE, DERIVED, COMPOSITE).

2. **Drag to canvas**: Click and drag a capability from the palette onto the canvas. Start with "Resolve Type" — it takes a type name and produces a TypeReference.

3. **Add more nodes**: Drag "Market Orders" onto the canvas. It needs a RegionReference and a TypeReference as inputs.

4. **Connect ports**: Click on the TypeReference output port (blue) on the Resolve Type node and drag to the TypeReference input port on the Market Orders node. The connection turns green when types are compatible.

5. **Inspect a node**: Click on any node to open the detail panel showing its inputs, outputs, source, authentication requirements, caching policy, and cost estimate.

6. **Validate**: Click "Validate" in the toolbar to compile the pipeline. The diagnostics panel at the bottom shows any errors, warnings, or suggestions. The GraphQL and Execution Plan tabs update with the generated artifacts.

7. **Execute**: Once validation passes, click "Execute". Watch as nodes light up during execution. Results appear in the Results tab with per-node timing and provenance.

## Key Interactions

| Action          | How                                   |
| --------------- | ------------------------------------- |
| Add a node      | Drag from palette to canvas           |
| Connect ports   | Drag from output port to input port   |
| Delete a node   | Select node, press Delete/Backspace   |
| Delete an edge  | Click edge, press Delete/Backspace    |
| Pan canvas      | Click and drag on empty canvas area   |
| Zoom            | Mouse wheel or pinch gesture          |
| Select node     | Click on the node                     |
| Multi-select    | Shift+click or drag selection box     |
| Save pipeline   | Click Save in toolbar, enter a name   |
| Export pipeline | Click Export to download as YAML file |
| Import pipeline | Click Import to load a YAML file      |

## Example Pipeline: Market Price Lookup

This pipeline resolves an item by name, fetches its market orders in a region, and returns sorted results:

```text
[Resolve Type] → [Market Orders] → [Sort by Price] → [Result]
       ↑                ↑
   (type name)    (region reference)
```

1. Drag "Resolve Type" onto the canvas
2. Drag "Market Orders" onto the canvas
3. Connect Resolve Type's `typeRef` output to Market Orders' `item` input
4. Drag "Sort" onto the canvas
5. Connect Market Orders' `orders` output to Sort's collection input
6. Configure Sort node: set sort key to "price", direction to "ascending"
7. Click Validate, then Execute

## Running Tests

```bash
# Unit tests for designer components
pnpm --filter designer test

# All project tests
pnpm test

# Type checking
pnpm run typecheck
```

## Troubleshooting

- **Palette is empty**: Ensure the gateway is running and the capability catalog is populated.
- **Connection rejected**: Hover over the port to see its semantic type. Connections require matching semantic types. Check the diagnostics panel for bridging suggestions.
- **Execution fails with AUTH_REQUIRED**: The pipeline uses capabilities that require ESI authentication scopes. Configure authentication in the gateway settings.
- **Canvas is slow**: Reduce the number of visible nodes by zooming in or using the minimap to navigate.
