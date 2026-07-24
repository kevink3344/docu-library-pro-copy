# Memory MCP Server

**Purpose:** A persistent knowledge graph that stores, retrieves, and manages structured information across sessions.

## Overview

The **memory MCP server** implements a directed knowledge graph composed of:

- **Entities** (nodes) — named items with a type and text observations
- **Relations** (edges) — directed links between entities in active voice
- The graph persists across sessions, allowing knowledge to accumulate over time

---

## Available Tools

| Tool | Purpose |
|------|---------|
| **`create_entities`** | Create one or more new entities. Each requires a `name`, `entityType`, and `observations` array. |
| **`create_relations`** | Create directed relations between entities (e.g., "ComponentA *uses* ComponentB"). Must be in active voice. |
| **`add_observations`** | Append new text observations to existing entities without recreating them. Useful for incremental updates. |
| **`delete_entities`** | Remove entities and all their associated relations from the graph. |
| **`delete_observations`** | Remove specific observations from entities. |
| **`delete_relations`** | Remove specific relations between entities. |
| **`read_graph`** | Retrieve the entire knowledge graph — all entities, observations, and relations. |
| **`search_nodes`** | Search nodes by matching against entity names, types, and observation content. |
| **`open_nodes`** | Retrieve specific nodes by their exact names. |

---

## Available Resource

| Resource | Purpose |
|----------|---------|
| **`memory://knowledge-graph`** | Direct read-only access to the full knowledge graph data. |

---

## Use Cases

| Use Case | Description |
|----------|-------------|
| **Project documentation** | Store entities for modules, APIs, configs, features, and track how they relate to each other. |
| **Architecture decision records** | Log architectural decisions with observations about context and rationale. Link decisions to the parts of the codebase they affect. |
| **Context persistence** | Unlike ephemeral conversation context, the knowledge graph persists between sessions, enabling long-term accumulation of project knowledge. |
| **Cross-referencing** | Link related concepts across different areas of the project (e.g., "EnvironmentConfig *uses* Vite, *uses* Supabase"). |

---

## Entity Example

```json
{
  "entities": [{
    "name": "Memory MCP Server",
    "entityType": "Tool",
    "observations": [
      "Implements a persistent knowledge graph",
      "Supports creating, reading, updating, and deleting entities and relations",
      "Data persists across sessions",
      "Accessible via use_mcp_tool and access_mcp_resource"
    ]
  }]
}
```

## Relation Example

```json
{
  "relations": [{
    "from": "Memory MCP Server",
    "relationType": "provides",
    "to": "knowledge-graph resource"
  }]
}
```

---

*Last updated: July 23, 2026*