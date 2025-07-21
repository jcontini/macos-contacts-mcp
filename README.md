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