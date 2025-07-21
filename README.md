# macOS Contacts for MCP

Connect your macOS Contacts app to AI assistants like Claude Desktop and Cursor. Search, view, and manage your contacts directly through conversations using your local Contacts data.

## What This Does

- **Search your contacts** by name or company
- **View full contact details** including emails, phones, and social links
- **Add new contacts** with notes, social media profiles (LinkedIn, Twitter, GitHub, etc.)
- **Update existing contacts** with new information and social links
- **Browse recent contacts** to see who you've added or modified

Works with your local macOS Contacts app - no need to sync with external services.

## Setup Instructions

### 1. Get the Code

```bash
git clone https://github.com/jcontini/macos-contacts-mcp.git
cd macos-contacts-mcp
npm install && npm run build
```

### 2. Add to Your AI Assistant

Add this configuration to your MCP client:

```json
{
  "mcpServers": {
    "macos-contacts": {
      "command": "node",
      "args": ["/path/to/your/macos-contacts-mcp/build/index.js"]
    }
  }
}
```

### 3. Grant Permissions

When you first use the contacts features, macOS will ask for permission:

1. **Contacts Access**: Allow your AI assistant to access Contacts
2. **Automation Permission**: Allow the app to control Contacts

You can also set these manually in **System Settings → Privacy & Security → Contacts** and **Automation**.

### 4. Restart Your Assistant

Close and reopen your AI assistant to load the new connection.

## Using It

Once set up, you can ask your AI assistant things like:

- "Find my contacts at Google"
- "Show me John's contact details and social links"
- "Add a new contact for Jane Smith with her LinkedIn profile"
- "Who did I add to contacts this week?"
- "Update John's job title and add his GitHub profile"

## Social Media Support

You can store and manage social media profiles for contacts:
- LinkedIn profiles
- Twitter/X accounts  
- GitHub profiles
- Facebook profiles
- Any other websites or social links

## Troubleshooting

**"Contact not found" errors:** Make sure the contact exists in your Contacts app with the exact name you're searching for.

**Permission errors:** Check System Settings → Privacy & Security and make sure your AI assistant has access to Contacts and Automation.

**Server won't start:** Make sure you ran `npm install && npm run build` and the path in your configuration is correct.

## Requirements

- macOS with the Contacts app
- Node.js (any recent version)
- An MCP-compatible AI assistant

Works with Claude Desktop, Cursor, and any other app that supports the Model Context Protocol.

## Future Plans

We're working on easier distribution methods to eliminate the need for manual installation:

### Desktop Extensions (.dxt)
Claude Desktop now supports one-click installation via Desktop Extensions. We plan to package this server as a `.dxt` file for:
- **No manual setup** - double-click to install
- **No dependencies** - Claude Desktop includes Node.js runtime
- **Automatic updates** - seamless version management
- **Curated directory** - discover through Claude Desktop's extension marketplace

### NPM Distribution
For developers who prefer package managers:
- **NPX support**: `npx macos-contacts-mcp` for instant usage
- **Global installation**: `npm install -g macos-contacts-mcp`  
- **Version management**: Easy updates via npm

### MCP Directory Listings
We're submitting to major MCP directories for better discoverability:
- **[Glama.ai](https://glama.ai/mcp/servers)** - Comprehensive MCP marketplace with quality ratings
- **[PulseMCP](https://www.pulsemcp.com/)** - Clean directory with 5000+ servers and filters
- **[McpServers.org](https://mcpservers.org/)** - Community-driven MCP server registry
- **[Awesome MCP Servers](https://github.com/punkpeye/awesome-mcp-servers)** - GitHub-based curated list

These improvements will make installation as simple as a single click or command while maintaining the same powerful local contact management capabilities.

## TODO: LLM-Friendly Improvements

Based on real-world usage with LLMs, the following improvements would make this MCP more robust:

### Better Special Character Handling
- **Issue**: AppleScript generation fails when contact notes contain apostrophes or other special characters (e.g., "Mike Ng's birthday party" causes syntax errors)
- **Solution**: Implement proper character escaping in AppleScript string generation
- **Why**: LLMs naturally include punctuation and special characters in notes and names, so the underlying AppleScript should handle these gracefully

### Input Sanitization & Validation
- **Issue**: LLMs don't intuitively know which characters will break AppleScript
- **Solution**: Either sanitize inputs automatically or provide clear error messages about problematic characters
- **Why**: LLMs should be able to use natural language without worrying about underlying implementation details

### Graceful Error Handling
- **Issue**: AppleScript syntax errors don't provide helpful feedback to LLMs about what went wrong
- **Solution**: Catch AppleScript errors and translate them into actionable error messages
- **Why**: Better error messages help LLMs understand and retry with corrected inputs