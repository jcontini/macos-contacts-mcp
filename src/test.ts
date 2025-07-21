#!/usr/bin/env node

import { execSync } from 'child_process';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  data?: any;
}

class ContactsMCPTester {
  private results: TestResult[] = [];
  private testContactIds: string[] = [];

  private executeAppleScript(script: string): string {
    try {
      const result = execSync(`osascript -e '${script.replace(/'/g, "\\'")}'`, {
        encoding: 'utf8',
        timeout: 30000,
      }).trim();
      return result;
    } catch (error) {
      throw new Error(`AppleScript execution failed: ${error}`);
    }
  }

  private async testCreateContact(name: string, data: any): Promise<TestResult> {
    try {
      // Build AppleScript to create contact
      let script = `
        tell application "Contacts"
          set newPerson to make new person with properties {name:"${name}"}
      `;

      if (data.organization) {
        script += `\n          set organization of newPerson to "${data.organization}"`;
      }
      if (data.job_title) {
        script += `\n          set job title of newPerson to "${data.job_title}"`;
      }
      if (data.note) {
        script += `\n          set note of newPerson to "${data.note}"`;
      }

      // Add emails
      if (data.emails) {
        data.emails.forEach((email: string, index: number) => {
          const label = index === 0 ? 'home' : index === 1 ? 'work' : `email${index + 1}`;
          script += `\n          make new email at end of emails of newPerson with properties {label:"${label}", value:"${email}"}`;
        });
      }

      // Add phones
      if (data.phones) {
        data.phones.forEach((phone: string, index: number) => {
          const label = index === 0 ? 'home' : index === 1 ? 'work' : `phone${index + 1}`;
          script += `\n          make new phone at end of phones of newPerson with properties {label:"${label}", value:"${phone}"}`;
        });
      }

      // Add URLs
      if (data.urls) {
        data.urls.forEach((url: any) => {
          script += `\n          make new url at end of urls of newPerson with properties {label:"${url.label}", value:"${url.value}"}`;
        });
      }

      script += `
          save
          return id of newPerson
        end tell
      `;

      const contactId = this.executeAppleScript(script);
      this.testContactIds.push(contactId);

      return {
        name: `Create Contact: ${name}`,
        passed: true,
        message: `Successfully created contact with ID: ${contactId}`,
        data: { id: contactId, ...data },
      };
    } catch (error) {
      return {
        name: `Create Contact: ${name}`,
        passed: false,
        message: `Failed to create contact: ${error}`,
      };
    }
  }

  private async testSearchContacts(query: string): Promise<TestResult> {
    try {
      const script = `
        tell application "Contacts"
          set foundPeople to {}
          set allPeople to people
          repeat with aPerson in allPeople
            set personName to name of aPerson
            set personOrg to organization of aPerson
            set personNote to note of aPerson
            if personName contains "${query}" or personOrg contains "${query}" or personNote contains "${query}" then
              set end of foundPeople to name of aPerson
            end if
            if (count of foundPeople) >= 10 then exit repeat
          end repeat
          return foundPeople
        end tell
      `;

      const result = this.executeAppleScript(script);
      const names = result.split(', ').filter(name => name.length > 0);

      return {
        name: `Search Contacts: "${query}"`,
        passed: names.length > 0,
        message: `Found ${names.length} contacts matching "${query}"`,
        data: names,
      };
    } catch (error) {
      return {
        name: `Search Contacts: "${query}"`,
        passed: false,
        message: `Search failed: ${error}`,
      };
    }
  }

  private async testGetContact(identifier: string): Promise<TestResult> {
    try {
      const script = `
        tell application "Contacts"
          try
            set targetPerson to person id "${identifier}"
          on error
            try
              set targetPerson to person "${identifier}"
            on error
              return "Contact not found"
            end try
          end try
          
          return "{" & ¬
            "\\"id\\": \\"" & id of targetPerson & "\\", " & ¬
            "\\"name\\": \\"" & name of targetPerson & "\\", " & ¬
            "\\"organization\\": \\"" & organization of targetPerson & "\\", " & ¬
            "\\"job_title\\": \\"" & job title of targetPerson & "\\"}"
        end tell
      `;

      const result = this.executeAppleScript(script);
      if (result === 'Contact not found') {
        return {
          name: `Get Contact: ${identifier}`,
          passed: false,
          message: 'Contact not found',
        };
      }

      const contact = JSON.parse(result);
      return {
        name: `Get Contact: ${identifier}`,
        passed: true,
        message: `Successfully retrieved contact: ${contact.name}`,
        data: contact,
      };
    } catch (error) {
      return {
        name: `Get Contact: ${identifier}`,
        passed: false,
        message: `Failed to get contact: ${error}`,
      };
    }
  }

  private async testUpdateContact(identifier: string, updates: any): Promise<TestResult> {
    try {
      let script = `
        tell application "Contacts"
          try
            set targetPerson to person id "${identifier}"
          on error
            set targetPerson to person "${identifier}"
          end try
      `;

      if (updates.organization !== undefined) {
        script += `\n          set organization of targetPerson to "${updates.organization}"`;
      }
      if (updates.job_title !== undefined) {
        script += `\n          set job title of targetPerson to "${updates.job_title}"`;
      }
      if (updates.note !== undefined) {
        script += `\n          set note of targetPerson to "${updates.note}"`;
      }

      script += `
          save
          return "Updated successfully"
        end tell
      `;

      this.executeAppleScript(script);

      return {
        name: `Update Contact: ${identifier}`,
        passed: true,
        message: `Successfully updated contact`,
        data: updates,
      };
    } catch (error) {
      return {
        name: `Update Contact: ${identifier}`,
        passed: false,
        message: `Failed to update contact: ${error}`,
      };
    }
  }

  private async testGetRecentContacts(daysBack: number = 30): Promise<TestResult> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);
      const cutoffString = cutoffDate.toISOString().split('T')[0];

      const script = `
        tell application "Contacts"
          set cutoffDate to date "${cutoffString}"
          set allPeople to people
          set recentPeople to {}
          
          repeat with aPerson in allPeople
            set contactDate to modification date of aPerson
            if contactDate ≥ cutoffDate then
              set end of recentPeople to name of aPerson
            end if
            if (count of recentPeople) >= 10 then exit repeat
          end repeat
          
          return recentPeople
        end tell
      `;

      const result = this.executeAppleScript(script);
      const names = result.split(', ').filter(name => name.length > 0);

      return {
        name: `Get Recent Contacts (${daysBack} days)`,
        passed: true,
        message: `Found ${names.length} recently modified contacts`,
        data: names,
      };
    } catch (error) {
      return {
        name: `Get Recent Contacts (${daysBack} days)`,
        passed: false,
        message: `Failed to get recent contacts: ${error}`,
      };
    }
  }

  private async runAllTests(): Promise<void> {
    console.log('🧪 Starting macOS Contacts MCP Test Suite\\n');

    // Test 1: Create Steve Jobs Test Contact
    const jobsResult = await this.testCreateContact('Steve Jobs Test', {
      organization: 'Apple Inc',
      job_title: 'Co-founder & CEO',
      emails: ['steve@apple.com', 'steve.jobs@test.com'],
      phones: ['+1-800-APL-CARE', '+1-555-0123'],
      urls: [
        { label: 'LinkedIn', value: 'https://linkedin.com/in/stevejobs' },
        { label: 'Company', value: 'https://apple.com' }
      ],
      note: '2025-01 Test contact for MCP development. Co-founded Apple Computer.',
    });
    this.results.push(jobsResult);

    // Test 2: Create Steve Wozniak Test Contact
    const wozResult = await this.testCreateContact('Steve Wozniak Test', {
      organization: 'Apple Inc',
      job_title: 'Co-founder & Engineer',
      emails: ['woz@apple.com'],
      phones: ['+1-555-0456'],
      urls: [
        { label: 'Twitter', value: 'https://twitter.com/stevewoz' },
        { label: 'GitHub', value: 'https://github.com/wozniak' }
      ],
      note: '2025-01 Test contact for MCP development. Technical co-founder of Apple.',
    });
    this.results.push(wozResult);

    // Test 3: Search for test contacts
    const searchResult = await this.testSearchContacts('Test');
    this.results.push(searchResult);

    // Test 4: Search by organization
    const orgSearchResult = await this.testSearchContacts('Apple');
    this.results.push(orgSearchResult);

    // Test 5: Get contact details (if Jobs was created successfully)
    if (jobsResult.passed && jobsResult.data) {
      const getResult = await this.testGetContact(jobsResult.data.id);
      this.results.push(getResult);
    }

    // Test 6: Update contact (if Wozniak was created successfully)
    if (wozResult.passed && wozResult.data) {
      const updateResult = await this.testUpdateContact(wozResult.data.id, {
        job_title: 'Co-founder & Chief Engineer',
        note: '2025-01 Updated test contact. Technical genius behind Apple I and Apple II.',
      });
      this.results.push(updateResult);

      // Test 7: Verify update by getting contact again
      const verifyResult = await this.testGetContact(wozResult.data.id);
      this.results.push(verifyResult);
    }

    // Test 8: Get recent contacts
    const recentResult = await this.testGetRecentContacts(1); // Last 1 day
    this.results.push(recentResult);

    // Test 9: General search functionality
    const generalSearchResult = await this.testSearchContacts('Steve');
    this.results.push(generalSearchResult);
  }

  private printResults(): void {
    console.log('\\n📊 Test Results Summary\\n');
    
    let passed = 0;
    let failed = 0;

    this.results.forEach((result, index) => {
      const status = result.passed ? '✅' : '❌';
      const number = String(index + 1).padStart(2, '0');
      
      console.log(`${status} Test ${number}: ${result.name}`);
      console.log(`    ${result.message}`);
      
      if (result.data && typeof result.data === 'object') {
        console.log(`    Data: ${JSON.stringify(result.data, null, 6)}`);
      } else if (result.data) {
        console.log(`    Data: ${result.data}`);
      }
      
      console.log();

      if (result.passed) passed++;
      else failed++;
    });

    console.log(`\\n🎯 Summary: ${passed} passed, ${failed} failed out of ${this.results.length} tests`);
    
    if (this.testContactIds.length > 0) {
      console.log(`\\n📝 Created test contacts with IDs:`);
      this.testContactIds.forEach(id => console.log(`    ${id}`));
      console.log(`\\n💡 Note: Test contacts remain in Contacts app for manual verification`);
    }
  }

  async run(): Promise<void> {
    try {
      await this.runAllTests();
      this.printResults();
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    }
  }
}

// Run tests
const tester = new ContactsMCPTester();
tester.run();