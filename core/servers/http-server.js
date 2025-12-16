/**
 * HTTP API Server for Browser Automation
 * 
 * Express-based REST API for running browser automation tasks.
 * 
 * Usage:
 *   npm run start:http
 *   # or
 *   node servers/http-server.js
 * 
 * Endpoints:
 *   POST /api/run         - Run agent with goal
 *   POST /api/extract     - Extract data from URL
 *   POST /api/workflow    - Execute .wky workflow
 *   GET  /api/status      - Get server status
 *   GET  /api/health      - Health check
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

// Import from core
const { BrowserAutomationAPI, runAgent, executeWorkflow } = require('../index');

const app = express();
const PORT = process.env.HTTP_PORT || 3000;

// Active sessions storage
const sessions = new Map();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// ============================================================================
// Health & Status
// ============================================================================

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/status', (req, res) => {
    res.json({
        status: 'running',
        activeSessions: sessions.size,
        uptime: process.uptime()
    });
});

// ============================================================================
// Agent Endpoints
// ============================================================================

/**
 * POST /api/run
 * Run agent with a goal
 * 
 * Body: { goal: string, url?: string, options?: { headless?, llmProvider?, maxSteps? } }
 */
app.post('/api/run', async (req, res) => {
    const { goal, url, options = {} } = req.body;

    if (!goal) {
        return res.status(400).json({ error: 'goal is required' });
    }

    try {
        console.log(`[run] Starting: ${goal.substring(0, 50)}...`);

        const result = await runAgent(goal, {
            headless: options.headless ?? true,
            llmProvider: options.llmProvider || 'gemini',
            maxSteps: options.maxSteps || 50
        });

        console.log(`[run] Completed: ${result.success ? 'success' : 'failed'}`);
        res.json(result);
    } catch (error) {
        console.error(`[run] Error: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/extract
 * Extract data from a URL
 * 
 * Body: { url: string, extractionGoal: string, options?: object }
 */
app.post('/api/extract', async (req, res) => {
    const { url, extractionGoal, options = {} } = req.body;

    if (!url || !extractionGoal) {
        return res.status(400).json({ error: 'url and extractionGoal are required' });
    }

    try {
        const goal = `Go to ${url} and ${extractionGoal}`;
        const result = await runAgent(goal, {
            headless: options.headless ?? true,
            llmProvider: options.llmProvider || 'gemini'
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/workflow
 * Execute a .wky workflow file
 * 
 * Body: { path: string, options?: object }
 */
app.post('/api/workflow', async (req, res) => {
    const { path: wkyPath, options = {} } = req.body;

    if (!wkyPath) {
        return res.status(400).json({ error: 'path is required' });
    }

    try {
        const fullPath = path.isAbsolute(wkyPath)
            ? wkyPath
            : path.join(__dirname, '..', wkyPath);

        const result = await executeWorkflow(fullPath, options);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// Session Endpoints (Persistent browser sessions)
// ============================================================================

/**
 * POST /api/session
 * Create a new browser session
 * 
 * Body: { options?: object }
 */
app.post('/api/session', async (req, res) => {
    const { options = {} } = req.body;
    const sessionId = `session_${Date.now()}`;

    try {
        const api = new BrowserAutomationAPI({
            headless: options.headless ?? true,
            llmProvider: options.llmProvider || 'gemini'
        });

        sessions.set(sessionId, { api, createdAt: new Date() });

        res.json({
            sessionId,
            status: 'created',
            message: 'Session created. Use /api/session/:id/run to execute goals.'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/session/:id/run
 * Run a goal in an existing session
 */
app.post('/api/session/:id/run', async (req, res) => {
    const { id } = req.params;
    const { goal, url } = req.body;

    const session = sessions.get(id);
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    try {
        const result = await session.api.run(goal, url);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/session/:id
 * Close a session
 */
app.delete('/api/session/:id', async (req, res) => {
    const { id } = req.params;
    const session = sessions.get(id);

    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    try {
        await session.api.close();
        sessions.delete(id);
        res.json({ status: 'closed' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/sessions
 * List all active sessions
 */
app.get('/api/sessions', (req, res) => {
    const list = Array.from(sessions.entries()).map(([id, session]) => ({
        id,
        createdAt: session.createdAt,
        status: session.api.getStatus()
    }));
    res.json(list);
});

// ============================================================================
// Error Handler
// ============================================================================

app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ============================================================================
// Start Server
// ============================================================================

app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════╗
║   Browser Automation HTTP API                          ║
╠════════════════════════════════════════════════════════╣
║   Server running on: http://localhost:${PORT}              ║
║                                                        ║
║   Endpoints:                                           ║
║     POST /api/run       - Run agent with goal          ║
║     POST /api/extract   - Extract data from URL        ║
║     POST /api/workflow  - Execute .wky workflow        ║
║     GET  /api/status    - Server status                ║
║     GET  /api/health    - Health check                 ║
║                                                        ║
║   Sessions:                                            ║
║     POST   /api/session      - Create session          ║
║     POST   /api/session/:id/run - Run in session       ║
║     DELETE /api/session/:id  - Close session           ║
╚════════════════════════════════════════════════════════╝
`);
});

module.exports = app;
