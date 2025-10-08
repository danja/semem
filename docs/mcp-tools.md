in `~/.codex/config.toml`

[mcp_servers.chrome-devtools]
command = "npx"
args = ["chrome-devtools-mcp@latest"]

[mcp_servers.erf]
command = "npx"
args = ["erf-analyzer@latest"]

[mcp_servers.server_name]
command = "npx"
# Optional
args = ["-y", "mcp-server"]
env = { "API_KEY" = "value" }
# or
[mcp_servers.server_name.env]
API_KEY = "value"

{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["chrome-devtools-mcp@latest"]
    }
  }
}

 *works for me :claude mcp add erf node /home/danny/hyperdata/erf/bin/erf-mcp.js*

*later : claude mcp add erf npx erf-analyzer*