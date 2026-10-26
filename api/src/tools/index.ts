import type OpenAI from 'openai';
import type { Database } from '../db.js';
import { searchContacts, getContact, createContact, updateContact } from './contacts.js';
import { listInteractions, logInteraction } from './interactions.js';
import { listReminders, createReminder, completeReminder } from './reminders.js';
import { listImportantDates, addImportantDate } from './dates.js';
import { getUserContext } from './context.js';

// Tool definitions in OpenAI format (compatible with Groq)
export const TOOLS: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_user_context',
      description: 'Get orientation context: current user info, upcoming reminders (next 7 days), overdue reminders, and upcoming important dates (next 30 days). Call this at the start of every new conversation.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_contacts',
      description: 'Search contacts by name, organization, nickname, or notes. Returns a list of matching contacts.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query string' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_contact',
      description: 'Get full details for a specific contact including contact methods, recent interactions, and important dates.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Contact UUID' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_contact',
      description: 'Create a new contact in the CRM.',
      parameters: {
        type: 'object',
        properties: {
          full_name: { type: 'string', description: 'Full name (required)' },
          nickname: { type: 'string', description: 'Preferred name or nickname' },
          organization: { type: 'string', description: 'Company or organization' },
          title: { type: 'string', description: 'Job title or role' },
          notes: { type: 'string', description: 'Freeform notes about this person' },
          groups: { type: 'array', items: { type: 'string' }, description: 'Groups/tags for this contact' },
          factoids: { type: 'array', items: { type: 'string' }, description: 'Quick facts about this person' },
        },
        required: ['full_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_contact',
      description: 'Update fields on an existing contact.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Contact UUID' },
          full_name: { type: 'string' },
          nickname: { type: 'string' },
          organization: { type: 'string' },
          title: { type: 'string' },
          notes: { type: 'string' },
          groups: { type: 'array', items: { type: 'string' } },
          factoids: { type: 'array', items: { type: 'string' } },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_interactions',
      description: 'List recent interactions with a contact.',
      parameters: {
        type: 'object',
        properties: {
          contact_id: { type: 'string', description: 'Contact UUID' },
          limit: { type: 'number', description: 'Max results (default 20)' },
        },
        required: ['contact_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'log_interaction',
      description: 'Log a new interaction with a contact (meeting, call, email, text, etc.).',
      parameters: {
        type: 'object',
        properties: {
          contact_id: { type: 'string', description: 'Contact UUID' },
          type: {
            type: 'string',
            enum: ['meeting', 'call', 'email', 'text', 'social', 'other'],
            description: 'Type of interaction',
          },
          date: { type: 'string', description: 'ISO 8601 datetime of the interaction' },
          notes: { type: 'string', description: 'Notes about the interaction' },
        },
        required: ['contact_id', 'type', 'date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_reminders',
      description: 'List reminders, optionally filtered.',
      parameters: {
        type: 'object',
        properties: {
          completed: { type: 'boolean', description: 'Filter by completion status' },
          contact_id: { type: 'string', description: 'Filter by contact' },
          due_before: { type: 'string', description: 'ISO 8601 datetime — only reminders due before this' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_reminder',
      description: 'Create a new reminder, optionally linked to a contact.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Reminder title' },
          notes: { type: 'string', description: 'Additional notes' },
          due_date: { type: 'string', description: 'ISO 8601 datetime when the reminder is due' },
          contact_id: { type: 'string', description: 'Optional contact UUID to link this reminder to' },
          recurrence_days: { type: 'number', description: 'If set, reminder recurs every N days after completion' },
          recurrence_end_date: { type: 'string', description: 'ISO 8601 datetime when recurrence stops' },
        },
        required: ['title', 'due_date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'complete_reminder',
      description: 'Mark a reminder as complete. If it has recurrence, the next instance will be created automatically.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Reminder UUID' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_important_dates',
      description: 'List important dates (birthdays, anniversaries, etc.), optionally for a specific contact.',
      parameters: {
        type: 'object',
        properties: {
          contact_id: { type: 'string', description: 'Optional contact UUID to filter dates for' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_important_date',
      description: 'Add an important date for a contact (birthday, anniversary, etc.).',
      parameters: {
        type: 'object',
        properties: {
          contact_id: { type: 'string', description: 'Contact UUID' },
          title: { type: 'string', description: 'Event name (e.g., "Birthday", "Anniversary")' },
          date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
          notes: { type: 'string', description: 'Optional notes' },
        },
        required: ['contact_id', 'title', 'date'],
      },
    },
  },
];

export type ToolName = string;

type ToolInput = Record<string, unknown>;

export async function executeTool(
  toolName: string,
  input: ToolInput,
  db: Database,
  userId: string
): Promise<unknown> {
  switch (toolName) {
    case 'get_user_context':
      return getUserContext({} as Record<string, never>, db, userId);
    case 'search_contacts':
      return searchContacts(input as { query: string }, db, userId);
    case 'get_contact':
      return getContact(input as { id: string }, db, userId);
    case 'create_contact':
      return createContact(input as Parameters<typeof createContact>[0], db, userId);
    case 'update_contact':
      return updateContact(input as Parameters<typeof updateContact>[0], db, userId);
    case 'list_interactions':
      return listInteractions(input as { contact_id: string; limit?: number }, db, userId);
    case 'log_interaction':
      return logInteraction(input as Parameters<typeof logInteraction>[0], db, userId);
    case 'list_reminders':
      return listReminders(input as Parameters<typeof listReminders>[0], db, userId);
    case 'create_reminder':
      return createReminder(input as Parameters<typeof createReminder>[0], db, userId);
    case 'complete_reminder':
      return completeReminder(input as { id: string }, db, userId);
    case 'list_important_dates':
      return listImportantDates(input as { contact_id?: string }, db, userId);
    case 'add_important_date':
      return addImportantDate(input as Parameters<typeof addImportantDate>[0], db, userId);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
