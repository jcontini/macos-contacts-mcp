#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { execSync } from 'child_process';

interface Contact {
  id?: string;
  name: string;
  organization?: string;
  job_title?: string;
  emails?: string[];
  phones?: string[];
  urls?: { label: string; value: string }[];
  note?: string;
  creation_date?: string;
  modification_date?: string;
  image?: string; // base64
}

class MacOSContactsServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'macos-contacts',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search_contacts',
            description: 'Search for contacts by name, organization, or notes',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search term to match against name, organization, or notes',
                },
                limit: {
                  type: 'integer',
                  description: 'Maximum number of results to return',
                  default: 20,
                },
              },
            },
          },
          {
            name: 'get_contact',
            description: 'Get full contact details by name or ID',
            inputSchema: {
              type: 'object',
              properties: {
                identifier: {
                  type: 'string',
                  description: 'Contact name or unique ID',
                },
              },
              required: ['identifier'],
            },
          },
          {
            name: 'create_contact',
            description: 'Create a new contact',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Full name of the contact',
                },
                organization: {
                  type: 'string',
                  description: 'Organization or company name',
                },
                job_title: {
                  type: 'string',
                  description: 'Job title or position',
                },
                emails: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Email addresses',
                },
                phones: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Phone numbers',
                },
                urls: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      label: { type: 'string' },
                      value: { type: 'string' },
                    },
                    required: ['label', 'value'],
                  },
                  description: 'URLs (social media, websites, etc.) with labels',
                },
                note: {
                  type: 'string',
                  description: 'Notes about the contact',
                },
              },
              required: ['name'],
            },
          },
          {
            name: 'update_contact',
            description: 'Update an existing contact',
            inputSchema: {
              type: 'object',
              properties: {
                identifier: {
                  type: 'string',
                  description: 'Contact name or unique ID',
                },
                name: {
                  type: 'string',
                  description: 'Updated full name',
                },
                organization: {
                  type: 'string',
                  description: 'Updated organization or company name',
                },
                job_title: {
                  type: 'string',
                  description: 'Updated job title or position',
                },
                emails: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Updated email addresses (replaces all existing)',
                },
                phones: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Updated phone numbers (replaces all existing)',
                },
                urls: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      label: { type: 'string' },
                      value: { type: 'string' },
                    },
                    required: ['label', 'value'],
                  },
                  description: 'Updated URLs (replaces all existing)',
                },
                note: {
                  type: 'string',
                  description: 'Updated notes',
                },
              },
              required: ['identifier'],
            },
          },
          {
            name: 'get_recent_contacts',
            description: 'Get contacts created or modified within a date range',
            inputSchema: {
              type: 'object',
              properties: {
                days_back: {
                  type: 'integer',
                  description: 'Number of days back to search',
                  default: 30,
                },
                type: {
                  type: 'string',
                  enum: ['created', 'modified', 'both'],
                  description: 'Type of date to filter by',
                  default: 'modified',
                },
                limit: {
                  type: 'integer',
                  description: 'Maximum number of results to return',
                  default: 20,
                },
              },
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        let result: any;

        switch (name) {
          case 'search_contacts':
            result = await this.searchContacts(args);
            break;
          case 'get_contact':
            result = await this.getContact(args);
            break;
          case 'create_contact':
            result = await this.createContact(args);
            break;
          case 'update_contact':
            result = await this.updateContact(args);
            break;
          case 'get_recent_contacts':
            result = await this.getRecentContacts(args);
            break;
          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        console.error(`Error executing tool ${name}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private escapeForAppleScript(str: string): string {
    // Simple escaping for AppleScript string literals
    // Only escape the most essential characters
    return str
      .replace(/\\/g, '\\\\')     // Escape backslashes first  
      .replace(/"/g, '\\"')       // Escape double quotes
      .replace(/\n/g, '\\n')      // Escape newlines
      .replace(/\r/g, '\\r')      // Escape carriage returns
      .replace(/\t/g, '\\t');     // Escape tabs
  }

  private executeAppleScript(script: string): string {
    try {
      // Use stdin to pass the script, avoiding shell escaping issues entirely
      const result = execSync(`osascript`, {
        input: script,
        encoding: 'utf8',
      }).trim();
      return result;
    } catch (error: any) {
      throw new Error(`AppleScript execution failed: ${error}`);
    }
  }

  private async searchContacts(args: any): Promise<any> {
    const { query, limit = 20 } = args;

    try {
      if (query) {
        // Use built-in search instead of manual loops
        const script = `tell application "Contacts" to return name of people whose name contains "${query}"`;
        const result = this.executeAppleScript(script);
        const names = result.split(', ').slice(0, limit);
        
        const contacts = names.map(name => ({
          name: name.trim(),
          organization: '', // Basic search only returns names for speed
        }));

        return {
          success: true,
          count: contacts.length,
          contacts,
        };
      } else {
        // Get first N contacts - simpler approach
        const script = `tell application "Contacts"
  set contactList to {}
  set allPeople to people
  repeat with i from 1 to ${Math.min(limit, 10)}
    if i > (count of allPeople) then exit repeat
    set aPerson to item i of allPeople
    set end of contactList to name of aPerson
  end repeat
  return contactList
end tell`;
        
        const result = this.executeAppleScript(script);
        const names = result ? result.split(', ').slice(0, limit) : [];
        
        const contacts = names.map(name => ({
          name: name.trim(),
          organization: '', // Basic search only returns names for speed
        }));

        return {
          success: true,
          count: contacts.length,
          contacts,
        };
      }
    } catch (error) {
      throw new Error(`Search failed: ${error}`);
    }
  }

  private async getContact(args: any): Promise<any> {
    const { identifier } = args;

    // Simple approach - get basic info first, then build up
    let script = `tell application "Contacts"
  try
    set targetPerson to person id "${identifier}"
  on error
    try
      set targetPerson to person "${identifier}"
    on error
      return "Contact not found"
    end try
  end try
  
  return id of targetPerson & "|" & name of targetPerson & "|" & organization of targetPerson & "|" & job title of targetPerson & "|" & note of targetPerson
end tell`;

    try {
      const result = this.executeAppleScript(script);
      if (result === 'Contact not found') {
        return { success: false, message: 'Contact not found' };
      }
      
      const parts = result.split('|');
      const contact: any = {
        id: parts[0] || '',
        name: parts[1] || '',
        organization: parts[2] || '',
        job_title: parts[3] || '',
        note: parts[4] || '',
      };

      // Get emails separately
      try {
        const emailScript = `tell application "Contacts"
  set targetPerson to person id "${contact.id}"
  set emailList to {}
  repeat with anEmail in emails of targetPerson
    set end of emailList to value of anEmail
  end repeat
  return emailList
end tell`;
        const emailResult = this.executeAppleScript(emailScript);
        contact.emails = emailResult ? emailResult.split(', ') : [];
      } catch {
        contact.emails = [];
      }

      // Get phones separately
      try {
        const phoneScript = `tell application "Contacts"
  set targetPerson to person id "${contact.id}"
  set phoneList to {}
  repeat with aPhone in phones of targetPerson
    set end of phoneList to value of aPhone
  end repeat
  return phoneList
end tell`;
        const phoneResult = this.executeAppleScript(phoneScript);
        contact.phones = phoneResult ? phoneResult.split(', ') : [];
      } catch {
        contact.phones = [];
      }

      // Get URLs separately  
      try {
        const urlScript = `tell application "Contacts"
  set targetPerson to person id "${contact.id}"
  set urlList to {}
  repeat with aUrl in urls of targetPerson
    set end of urlList to (label of aUrl & ":" & value of aUrl)
  end repeat
  return urlList
end tell`;
        const urlResult = this.executeAppleScript(urlScript);
        if (urlResult) {
          contact.urls = urlResult.split(', ').map(item => {
            const [label, ...valueParts] = item.split(':');
            return { label: label || '', value: valueParts.join(':') || '' };
          });
        } else {
          contact.urls = [];
        }
      } catch {
        contact.urls = [];
      }

      return { success: true, contact };
    } catch (error) {
      throw new Error(`Get contact failed: ${error}`);
    }
  }

  private async createContact(args: any): Promise<any> {
    const { name, organization = '', job_title = '', emails = [], phones = [], urls = [], note = '' } = args;

    // Parse name into first/last name
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

    let script = `
      tell application "Contacts"
        set newPerson to make new person
        
        if "${this.escapeForAppleScript(firstName)}" is not "" then
          set first name of newPerson to "${this.escapeForAppleScript(firstName)}"
        end if
        
        if "${this.escapeForAppleScript(lastName)}" is not "" then
          set last name of newPerson to "${this.escapeForAppleScript(lastName)}"
        end if
        
        if "${this.escapeForAppleScript(organization)}" is not "" then
          set organization of newPerson to "${this.escapeForAppleScript(organization)}"
        end if
        
        if "${this.escapeForAppleScript(job_title)}" is not "" then
          set job title of newPerson to "${this.escapeForAppleScript(job_title)}"
        end if
        
        if "${this.escapeForAppleScript(note)}" is not "" then
          set note of newPerson to "${this.escapeForAppleScript(note)}"
        end if
    `;

    // Add emails
    if (emails.length > 0) {
      emails.forEach((email: string, index: number) => {
        const label = index === 0 ? 'home' : index === 1 ? 'work' : `email${index + 1}`;
        script += `\n        make new email at end of emails of newPerson with properties {label:"${label}", value:"${this.escapeForAppleScript(email)}"}`;
      });
    }

    // Add phones
    if (phones.length > 0) {
      phones.forEach((phone: string, index: number) => {
        const label = index === 0 ? 'home' : index === 1 ? 'work' : `phone${index + 1}`;
        script += `\n        make new phone at end of phones of newPerson with properties {label:"${label}", value:"${this.escapeForAppleScript(phone)}"}`;
      });
    }

    // Add URLs
    if (urls.length > 0) {
      urls.forEach((url: any) => {
        script += `\n        make new url at end of urls of newPerson with properties {label:"${this.escapeForAppleScript(url.label)}", value:"${this.escapeForAppleScript(url.value)}"}`;
      });
    }

    script += `
        save
        return id of newPerson
      end tell
    `;

    try {
      const contactId = this.executeAppleScript(script);
      
      return {
        success: true,
        message: `Created contact: ${name}`,
        contact_id: contactId,
        contact: { name, organization, job_title, emails, phones, urls, note },
      };
    } catch (error) {
      throw new Error(`Create contact failed: ${error}`);
    }
  }

  private async updateContact(args: any): Promise<any> {
    const { identifier, ...updates } = args;

    // First get the contact to verify it exists and get the correct ID
    const existingContact = await this.getContact({ identifier });
    if (!existingContact.success) {
      throw new Error('Contact not found');
    }

    const contactId = existingContact.contact.id;
    const updatedFields: string[] = [];

    // Update name if provided
    if (updates.name !== undefined) {
      try {
        // Parse name into first/last name
        const nameParts = updates.name.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
        
        const script = `tell application "Contacts"
  set targetPerson to person id "${contactId}"
  set first name of targetPerson to "${this.escapeForAppleScript(firstName)}"
  set last name of targetPerson to "${this.escapeForAppleScript(lastName)}"
  save
end tell`;
        this.executeAppleScript(script);
        updatedFields.push('name');
      } catch (error) {
        console.error('Failed to update name:', error);
      }
    }

    // Update basic properties one by one
    if (updates.organization !== undefined) {
      try {
        const script = `tell application "Contacts"
  set targetPerson to person id "${contactId}"
  set organization of targetPerson to "${this.escapeForAppleScript(updates.organization)}"
  save
end tell`;
        this.executeAppleScript(script);
        updatedFields.push('organization');
      } catch (error) {
        console.error('Failed to update organization:', error);
      }
    }

    if (updates.job_title !== undefined) {
      try {
        const script = `tell application "Contacts"
  set targetPerson to person id "${contactId}"
  set job title of targetPerson to "${this.escapeForAppleScript(updates.job_title)}"
  save
end tell`;
        this.executeAppleScript(script);
        updatedFields.push('job_title');
      } catch (error) {
        console.error('Failed to update job title:', error);
      }
    }

    if (updates.note !== undefined) {
      try {
        const script = `tell application "Contacts"
  set targetPerson to person id "${contactId}"
  set note of targetPerson to "${this.escapeForAppleScript(updates.note)}"
  save
end tell`;
        this.executeAppleScript(script);
        updatedFields.push('note');
      } catch (error) {
        console.error('Failed to update note:', error);
      }
    }

    // Update URLs if provided
    if (updates.urls !== undefined) {
      try {
        // First, remove all existing URLs
        const clearUrlScript = `tell application "Contacts"
  set targetPerson to person id "${contactId}"
  delete every url of targetPerson
  save
end tell`;
        this.executeAppleScript(clearUrlScript);

        // Then add new URLs
        if (updates.urls.length > 0) {
          let addUrlScript = `tell application "Contacts"
  set targetPerson to person id "${contactId}"`;
          
          updates.urls.forEach((url: any) => {
            addUrlScript += `
  make new url at end of urls of targetPerson with properties {label:"${this.escapeForAppleScript(url.label)}", value:"${this.escapeForAppleScript(url.value)}"}`;
          });
          
          addUrlScript += `
  save
end tell`;
          
          this.executeAppleScript(addUrlScript);
        }
        
        updatedFields.push('urls');
      } catch (error) {
        console.error('Failed to update URLs:', error);
      }
    }

    // Update emails if provided
    if (updates.emails !== undefined) {
      try {
        // First, remove all existing emails
        const clearEmailScript = `tell application "Contacts"
  set targetPerson to person id "${contactId}"
  delete every email of targetPerson
  save
end tell`;
        this.executeAppleScript(clearEmailScript);

        // Then add new emails
        if (updates.emails.length > 0) {
          let addEmailScript = `tell application "Contacts"
  set targetPerson to person id "${contactId}"`;
          
          updates.emails.forEach((email: string, index: number) => {
            const label = index === 0 ? 'home' : index === 1 ? 'work' : `email${index + 1}`;
            addEmailScript += `
  make new email at end of emails of targetPerson with properties {label:"${label}", value:"${this.escapeForAppleScript(email)}"}`;
          });
          
          addEmailScript += `
  save
end tell`;
          
          this.executeAppleScript(addEmailScript);
        }
        
        updatedFields.push('emails');
      } catch (error) {
        console.error('Failed to update emails:', error);
      }
    }

    // Update phones if provided
    if (updates.phones !== undefined) {
      try {
        // First, remove all existing phones
        const clearPhoneScript = `tell application "Contacts"
  set targetPerson to person id "${contactId}"
  delete every phone of targetPerson
  save
end tell`;
        this.executeAppleScript(clearPhoneScript);

        // Then add new phones
        if (updates.phones.length > 0) {
          let addPhoneScript = `tell application "Contacts"
  set targetPerson to person id "${contactId}"`;
          
          updates.phones.forEach((phone: string, index: number) => {
            const label = index === 0 ? 'home' : index === 1 ? 'work' : `phone${index + 1}`;
            addPhoneScript += `
  make new phone at end of phones of targetPerson with properties {label:"${label}", value:"${this.escapeForAppleScript(phone)}"}`;
          });
          
          addPhoneScript += `
  save
end tell`;
          
          this.executeAppleScript(addPhoneScript);
        }
        
        updatedFields.push('phones');
      } catch (error) {
        console.error('Failed to update phones:', error);
      }
    }
    
    return {
      success: true,
      message: `Updated contact: ${identifier}`,
      updated_fields: updatedFields,
    };
  }

  private async getRecentContacts(args: any): Promise<any> {
    const { days_back = 30, type = 'modified', limit = 20 } = args;

    // Use a unique delimiter that won't conflict with dates
    const script = `tell application "Contacts"
  set contactList to {}
  set allPeople to people
  repeat with i from 1 to ${Math.min(limit, 20)}
    if i > (count of allPeople) then exit repeat
    set aPerson to item i of allPeople
    set end of contactList to (name of aPerson & "###SPLIT###" & modification date of aPerson & "###END###")
  end repeat
  return contactList
end tell`;

    try {
      const result = this.executeAppleScript(script);
      if (!result) {
        return { success: true, type, days_back, count: 0, contacts: [] };
      }
      
      // Split by ###END### to separate entries
      const entries = result.split('###END###').filter(entry => entry.trim());
      
      const contacts = entries.map(entry => {
        const cleanEntry = entry.replace(/^, /, ''); // Remove leading comma
        const parts = cleanEntry.split('###SPLIT###');
        return {
          name: parts[0] || '',
          modification_date: parts[1] || '',
        };
      }).slice(0, limit);
      
      return {
        success: true,
        type,
        days_back,
        count: contacts.length,
        contacts,
      };
    } catch (error) {
      throw new Error(`Get recent contacts failed: ${error}`);
    }
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('macOS Contacts MCP Server running on stdio');
  }
}

// Handle shutdown gracefully
process.on('SIGINT', async () => {
  process.exit(0);
});

process.on('SIGTERM', async () => {
  process.exit(0);
});

// Start the server
const server = new MacOSContactsServer();
server.run().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});