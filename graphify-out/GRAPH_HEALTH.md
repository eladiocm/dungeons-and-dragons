# Diagnóstico de extracción

```text
[graphify] MultiDiGraph edge-collapse diagnostic
input: <in-memory>
input_stage: provided JSON (normal graph.json is post-build)
effective_directed: <direct-call>
nodes: 463
unverified_code_nodes: 0
raw_edges: 1619
valid_candidate_edges: 1591
missing_endpoint_edges: 0
dangling_endpoint_edges: 1
external_reference_edges: 27
self_loop_edges: 2
exact_duplicate_edges: 0
directed_unique_endpoint_pairs: 1587
directed_same_endpoint_collapsed_edges: 4
undirected_unique_endpoint_pairs: 1586
undirected_same_endpoint_collapsed_edges: 5
same_endpoint_group_count: 4
relation_variant_groups: 3
source_file_variant_groups: 0
source_location_variant_groups: 1
context_variant_groups: 0
post_build_graph_type: DiGraph
post_build_edges: 1615
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
examples:
  - ext_src_game_battle_effects_ts -> ext_src_game_combat_types_ts edges=2 relations=['dynamic_import', 'imports_from'] locations=['', 'L2'] contexts=['', 'import']
  - ext_src_game_session_types_ts -> ext_src_game_combat_types_ts edges=2 relations=['dynamic_import', 'imports_from'] locations=['', 'L1'] contexts=['', 'import']
  - ext_src_game_session_types_ts -> ext_src_game_types_ts edges=2 relations=['dynamic_import', 'imports_from'] locations=['', 'L3'] contexts=['', 'import']
  - ext_src_server_media_api_ts -> ext_src_server_game_service_ts edges=2 relations=['imports_from'] locations=['L8', 'L9'] contexts=['import']
note: normal graph.json is post-build; raw producer loss must be measured earlier.
```
