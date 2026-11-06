# Diagnóstico del grafo cloud 0.4.1

Grafo de código y pruebas actualizado el 6 de noviembre de 2026, sin extracción semántica mediante IA. El diagnóstico siguiente corresponde al grafo exportado; no mide relaciones ya combinadas por la extracción. La migración SQL no se extrajo porque falta tree_sitter_sql en el entorno de herramientas. Su revisión y prueba real se hicieron por separado; no interpretar su ausencia como ausencia de dependencia. Las etiquetas se regeneraron desde los nodos centrales, sin gastar cuota de IA.

```text
[graphify] MultiDiGraph edge-collapse diagnostic
input: <in-memory>
input_stage: provided JSON (normal graph.json is post-build)
effective_directed: <direct-call>
nodes: 821
unverified_code_nodes: 0
raw_edges: 2262
valid_candidate_edges: 2262
missing_endpoint_edges: 0
dangling_endpoint_edges: 0
external_reference_edges: 0
self_loop_edges: 2
exact_duplicate_edges: 0
directed_unique_endpoint_pairs: 2262
directed_same_endpoint_collapsed_edges: 0
undirected_unique_endpoint_pairs: 2260
undirected_same_endpoint_collapsed_edges: 2
same_endpoint_group_count: 0
relation_variant_groups: 0
source_file_variant_groups: 0
source_location_variant_groups: 0
context_variant_groups: 0
post_build_graph_type: DiGraph
post_build_edges: 2262
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
