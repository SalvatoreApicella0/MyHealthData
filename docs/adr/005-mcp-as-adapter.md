# ADR 005: MCP is an adapter

The stdio MCP process calls the Hub REST domain API; it does not own a health database or duplicate validation. It requires a high-entropy `MHD_MCP_CAPABILITY` on every JSON-RPC request via `_meta["io.myhealthdata/capability"]`, and exposes only the scopes listed in `MHD_MCP_SCOPES` (default: `measurements:read`). This capability must be injected by the local MCP host, never placed in an agent prompt or tool argument.
