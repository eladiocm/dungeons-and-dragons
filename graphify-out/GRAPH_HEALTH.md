# Diagnóstico del grafo 0.4.2

6 de noviembre de 2026. Grafo estructural de código/pruebas exportado, sin extracción semántica de documentos ni gasto de IA. El diagnóstico mide el exportado, no relaciones colapsadas antes de construirlo. Tres migraciones SQL no extraídas: falta el parser opcional tree_sitter_sql; revisión y pruebas remotas separadas. Cambiaron comunidades (35→43); nombres ajustados por nodo central sin modelo. CSS y archivos de configuración no soportados se omiten.

```text
[graphify] MultiDiGraph edge-collapse diagnostic
input: <in-memory>
input_stage: provided JSON (normal graph.json is post-build)
effective_directed: <direct-call>
nodes: 841
unverified_code_nodes: 0
raw_edges: 2315
valid_candidate_edges: 2315
missing_endpoint_edges: 0
dangling_endpoint_edges: 0
external_reference_edges: 0
self_loop_edges: 2
exact_duplicate_edges: 0
directed_unique_endpoint_pairs: 2315
directed_same_endpoint_collapsed_edges: 0
undirected_unique_endpoint_pairs: 2313
undirected_same_endpoint_collapsed_edges: 2
same_endpoint_group_count: 0
relation_variant_groups: 0
source_file_variant_groups: 0
source_location_variant_groups: 0
context_variant_groups: 0
post_build_graph_type: DiGraph
post_build_edges: 2315
producer_suppression_sites: 12
producer_suppression_examples:
  - L1651 seen_ids arity=unknown
  - L2184 seen_ids arity=unknown
  - L2186 seen_doc_refs arity=unknown
  - L2556 seen_ids arity=unknown
  - L2703 seen_ids arity=unknown
  - L3429 seen_keys arity=unknown
  - L3598 seen_keys arity=unknown
  - L5675 seen_ids arity=unknown
note: normal graph.json is post-build; raw producer loss must be measured earlier.
```
