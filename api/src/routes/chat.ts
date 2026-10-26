import { Hono } from 'hono';
import { z } from 'zod';
import OpenAI from 'openai';
import { createDb } from '../db.js';
import { TOOLS, executeTool } from '../tools/index.js';
import type { AppContext } from '../auth.js';

export const chatRouter = new Hono<AppContext>();

const MAX_HISTORY_MESSAGES = 20;
const MODEL = 'openai/gpt-oss-120b';

function getSystemPrompt(userName: string): string {
  const today = new Date().toISOString().split('T')[0];
  return `You are a personal CRM assistant for a trusted household. You help manage relationships, track interactions, set reminders, and keep notes on the people that matter most.

You are operating on behalf of ${userName}. Today is ${today}.

Guidelines:
- Be concise and action-oriented. When you create or update records, confirm what you did briefly.
- When asked to find contacts, use search_contacts first.
- Always call get_user_context at the start of a new conversation to orient yourself.
- Never fabricate contact data. If a contact isn't found, say so clearly.
- When creating records, prefer action over confirmation — just do it, then confirm what you did.
- Use natural, friendly language appropriate for a personal assistant.
- When referencing dates, use the user's local context (today is ${today}).`;
}

// GET /api/chat/sessions
chatRouter.get('/sessions', async (c) => {
  const userId = c.get('userId');
  const db = createDb(c.env);

  const sessions = await db.query<Record<string, unknown>>(
    `SELECT id, title, created_at, updated_at FROM chat_sessions
     WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50`,
    [userId]
  );

  return c.json({ data: sessions });
});

// POST /api/chat/sessions
chatRouter.post('/sessions', async (c) => {
  const userId = c.get('userId');
  const db = createDb(c.env);

  const body = await c.req.json().catch(() => ({})) as { title?: string };
  const title = body.title ?? 'New conversation';

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.execute(
    'INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [id, userId, title, now, now]
  );

  return c.json({ data: { id, title, created_at: now, updated_at: now } }, 201);
});

// GET /api/chat/sessions/:id/messages
chatRouter.get('/sessions/:id/messages', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('id');
  const db = createDb(c.env);

  const session = await db.queryOne<{ id: string }>(
    'SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?',
    [sessionId, userId]
  );
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  const messages = await db.query<Record<string, unknown>>(
    `SELECT id, role, content, tool_calls, created_at FROM chat_messages
     WHERE session_id = ? ORDER BY created_at ASC`,
    [sessionId]
  );

  const parsed = messages.map((m) => ({
    ...m,
    tool_calls: typeof m.tool_calls === 'string'
      ? (() => { try { return JSON.parse(m.tool_calls as string); } catch { return null; } })()
      : m.tool_calls ?? null,
  }));

  return c.json({ data: parsed });
});

// POST /api/chat/sessions/:id/messages
chatRouter.post('/sessions/:id/messages', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('id');

  const body = await c.req.json().catch(() => null);
  const schema = z.object({ content: z.string().min(1) });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  const db = createDb(c.env);

  const session = await db.queryOne<{ id: string; title: string }>(
    'SELECT id, title FROM chat_sessions WHERE id = ? AND user_id = ?',
    [sessionId, userId]
  );
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  const user = await db.queryOne<{ name: string }>(
    'SELECT name FROM users WHERE id = ?',
    [userId]
  );

  const userMessage = parsed.data.content;
  const userMsgId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Save user message
  await db.execute(
    'INSERT INTO chat_messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
    [userMsgId, sessionId, 'user', userMessage, now]
  );

  // Update session title if it's the first message
  if (session.title === 'New conversation') {
    const title = userMessage.slice(0, 60) + (userMessage.length > 60 ? '…' : '');
    await db.execute(
      'UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ?',
      [title, now, sessionId]
    );
  } else {
    await db.execute('UPDATE chat_sessions SET updated_at = ? WHERE id = ?', [now, sessionId]);
  }

  // Load history
  const history = await db.query<{ role: string; content: string }>(
    `SELECT role, content FROM chat_messages
     WHERE session_id = ? ORDER BY created_at DESC LIMIT ?`,
    [sessionId, MAX_HISTORY_MESSAGES]
  );
  history.reverse();

  // Build messages array (exclude the message we just inserted, add it fresh)
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: getSystemPrompt(user?.name ?? 'User') },
    ...history
      .filter((m) => m.content !== userMessage || m.role !== 'user')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: userMessage },
  ];

  const groq = new OpenAI({
    apiKey: process.env['GROQ_API_KEY'] ?? '',
    baseURL: 'https://api.groq.com/openai/v1',
  });

  // SSE streaming response
  return new Response(
    new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        function send(data: Record<string, unknown>) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        }

        const toolCallsLog: Array<{ tool: string; input: unknown; output: unknown; success: boolean }> = [];

        try {
          let currentMessages = [...messages];

          // Agentic loop
          while (true) {
            const response = await groq.chat.completions.create({
              model: MODEL,
              max_tokens: 4096,
              messages: currentMessages,
              tools: TOOLS,
              tool_choice: 'auto',
            });

            const choice = response.choices[0];
            if (!choice) break;

            const assistantMessage = choice.message;
            currentMessages.push(assistantMessage);

            // Stream any text content
            if (assistantMessage.content) {
              send({ type: 'text', text: assistantMessage.content });
            }

            // If no tool calls or model is done, exit loop
            if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0 || choice.finish_reason === 'stop') {
              break;
            }

            // Execute tool calls
            const toolResultMessages: OpenAI.ChatCompletionToolMessageParam[] = [];

            for (const toolCall of assistantMessage.tool_calls) {
              if (toolCall.type !== 'function') continue;
              const toolName = toolCall.function.name;
              let toolInput: Record<string, unknown>;
              try {
                toolInput = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
              } catch {
                toolInput = {};
              }

              send({ type: 'tool_start', tool: toolName, id: toolCall.id });

              try {
                const result = await executeTool(toolName, toolInput, db, userId);

                toolCallsLog.push({ tool: toolName, input: toolInput, output: result, success: true });
                send({ type: 'tool_end', tool: toolName, id: toolCall.id, result });

                toolResultMessages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: JSON.stringify(result),
                });
              } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Tool execution failed';

                toolCallsLog.push({ tool: toolName, input: toolInput, output: { error: errorMsg }, success: false });
                send({ type: 'tool_error', tool: toolName, id: toolCall.id, error: errorMsg });

                toolResultMessages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: `Error: ${errorMsg}`,
                });
              }
            }

            currentMessages.push(...toolResultMessages);
          }

          // Collect final assistant text from all assistant turns after the initial messages
          const finalText = currentMessages
            .slice(messages.length)
            .filter((m): m is OpenAI.ChatCompletionAssistantMessageParam => m.role === 'assistant')
            .map((m) => (typeof m.content === 'string' ? m.content : ''))
            .filter(Boolean)
            .join('\n');

          // Save assistant message
          const assistantMsgId = crypto.randomUUID();
          const assistantNow = new Date().toISOString();

          await db.execute(
            'INSERT INTO chat_messages (id, session_id, role, content, tool_calls, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [
              assistantMsgId, sessionId, 'assistant', finalText,
              toolCallsLog.length > 0 ? JSON.stringify(toolCallsLog) : null,
              assistantNow,
            ]
          );

          await db.execute('UPDATE chat_sessions SET updated_at = ? WHERE id = ?', [assistantNow, sessionId]);

          send({ type: 'done', messageId: assistantMsgId });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'An error occurred';
          send({ type: 'error', error: errorMsg });
        } finally {
          controller.close();
        }
      },
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
});

// MCP-compatible endpoint for external agent access
chatRouter.post('/mcp/execute', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => null);

  const schema = z.object({
    tool: z.string(),
    input: z.record(z.unknown()),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request body', details: parsed.error.flatten() }, 400);
  }

  const db = createDb(c.env);

  try {
    const result = await executeTool(parsed.data.tool, parsed.data.input, db, userId);
    return c.json({ data: result });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Tool execution failed';
    return c.json({ error: errorMsg }, 400);
  }
});

// MCP tools manifest
chatRouter.get('/mcp/tools', async (c) => {
  return c.json({ data: TOOLS });
});
