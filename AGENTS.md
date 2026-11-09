# Development guidelines

## V3 Schema / Nodes 2.0

Python registration uses `io.ComfyNode`, `define_schema()`, `io.NodeOutput`, `ComfyExtension`, and `comfy_entrypoint()`. It does not use V1 `NODE_CLASS_MAPPINGS`.

The UI uses the `addDOMWidget()` DOM bridge with an independent Shadow DOM / SVG editor. It does not depend on `inputEl`, `onDrawForeground`, or global LiteGraph patches. Editor state is stored only in the original STRING widget; the DOM widget is not serialized a second time.

To add future nodes, place them in `nodes/` and register them in `get_node_list()` in the root `__init__.py`. JavaScript features can be organized into separate modules under `web/`.

References: [Official V3 migration guide](https://docs.comfy.org/custom-nodes/v3_migration), [official JavaScript extension guide](https://docs.comfy.org/custom-nodes/js/javascript_overview).

## Tests

Run from the repository root:

```powershell
python -m unittest discover -s tests -v
node --test tests/*.test.mjs
```

[`tests/preview.html`](tests/preview.html) provides a standalone editor preview. Serve the repository root over a local HTTP server and open that page.
