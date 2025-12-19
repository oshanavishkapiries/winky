/**
 * SkillOrchestrator - Routes user commands to appropriate skills using LLM
 * 
 * The orchestrator uses the LLM to understand user intent and match it
 * to the most appropriate registered skill.
 * 
 * @example
 * const orchestrator = new SkillOrchestrator(llmAdapter);
 * orchestrator.register(MapsScraperSkill);
 * orchestrator.register(LinkedInApplySkill);
 * 
 * const result = await orchestrator.route('scrape 20 cafes from google maps');
 * // Returns: { skill: 'maps_scraper', args: { query: 'cafes', count: 20 } }
 */

const fs = require('fs');
const path = require('path');

class SkillOrchestrator {
    constructor(llmAdapter) {
        this.llm = llmAdapter;
        this.skills = new Map();
        this.pluginsDir = path.join(__dirname, 'plugins');
    }

    /**
     * Register a skill class
     * @param {Class} SkillClass - Skill class extending BaseSkill
     */
    register(SkillClass) {
        if (!SkillClass.type || SkillClass.type === 'unknown') {
            throw new Error('Skill class must have a static "type" property');
        }
        this.skills.set(SkillClass.type, SkillClass);
    }

    /**
     * Auto-load all skill plugins from the plugins directory
     */
    loadPlugins() {
        if (!fs.existsSync(this.pluginsDir)) {
            fs.mkdirSync(this.pluginsDir, { recursive: true });
            return;
        }

        const files = fs.readdirSync(this.pluginsDir)
            .filter(file => file.endsWith('.skill.js'));

        for (const file of files) {
            try {
                const SkillClass = require(path.join(this.pluginsDir, file));
                const ActualClass = SkillClass.default || SkillClass;

                if (ActualClass.type && ActualClass.type !== 'unknown') {
                    this.register(ActualClass);
                    console.log(`[orchestrator] Loaded skill: ${ActualClass.type}`);
                }
            } catch (error) {
                console.error(`[orchestrator] Failed to load skill ${file}: ${error.message}`);
            }
        }
    }

    /**
     * Get all registered skills metadata
     * @returns {Array<Object>}
     */
    getSkillsMetadata() {
        return Array.from(this.skills.entries()).map(([type, SkillClass]) => ({
            type,
            description: SkillClass.description || '',
            triggers: SkillClass.triggers || []
        }));
    }

    /**
     * Route a user command to the appropriate skill
     * @param {string} userCommand - Natural language command
     * @returns {Promise<Object>} - { skillType, args, confidence }
     */
    async route(userCommand) {
        const skillsMetadata = this.getSkillsMetadata();

        if (skillsMetadata.length === 0) {
            return { skillType: null, args: {}, confidence: 0, reason: 'No skills registered' };
        }

        const prompt = this.buildRoutingPrompt(userCommand, skillsMetadata);

        try {
            const response = await this.llm.generateRaw(prompt);
            return this.parseRoutingResponse(response, userCommand);
        } catch (error) {
            console.error('[orchestrator] Routing failed:', error.message);
            // Fallback: try keyword matching
            return this.fallbackRoute(userCommand, skillsMetadata);
        }
    }

    /**
     * Build the prompt for skill routing
     * @param {string} userCommand - User's command
     * @param {Array} skills - Skills metadata
     * @returns {string} - Prompt for LLM
     */
    buildRoutingPrompt(userCommand, skills) {
        const skillDocs = skills.map(s =>
            `- **${s.type}**: ${s.description}\n  Triggers: ${s.triggers.join(', ')}`
        ).join('\n');

        return `You are a task router. Analyze the user command and decide which skill should handle it.

## AVAILABLE SKILLS
${skillDocs}

## USER COMMAND
"${userCommand}"

## INSTRUCTIONS
1. Match the command to the most appropriate skill based on description and triggers
2. Extract relevant arguments from the command (query, location, count, etc.)
3. Return a confidence score (0.0 to 1.0)

## RESPONSE FORMAT
Return ONLY valid JSON:
{
    "skill": "skill_type_name or null if no match",
    "args": {
        "query": "extracted search term",
        "location": "extracted location if any",
        "count": number_extracted_or_default_20
    },
    "confidence": 0.0-1.0,
    "reason": "brief explanation"
}

If no skill matches, return: { "skill": null, "args": {}, "confidence": 0, "reason": "No matching skill" }`;
    }

    /**
     * Parse the LLM routing response
     * @param {string} response - Raw LLM response
     * @param {string} userCommand - Original command
     * @returns {Object} - Parsed routing result
     */
    parseRoutingResponse(response, userCommand) {
        try {
            // Clean response (remove markdown code blocks if present)
            let cleanResponse = response.trim();
            if (cleanResponse.startsWith('```json')) {
                cleanResponse = cleanResponse.slice(7);
            }
            if (cleanResponse.startsWith('```')) {
                cleanResponse = cleanResponse.slice(3);
            }
            if (cleanResponse.endsWith('```')) {
                cleanResponse = cleanResponse.slice(0, -3);
            }

            const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    skillType: parsed.skill,
                    args: parsed.args || {},
                    confidence: parsed.confidence || 0.5,
                    reason: parsed.reason || 'LLM routed'
                };
            }
        } catch (e) {
            console.error('[orchestrator] Failed to parse routing response:', e.message);
        }

        // Return no match
        return { skillType: null, args: {}, confidence: 0, reason: 'Parse failed' };
    }

    /**
     * Fallback routing using keyword matching
     * @param {string} userCommand - User command
     * @param {Array} skills - Skills metadata
     * @returns {Object} - Routing result
     */
    fallbackRoute(userCommand, skills) {
        const lowerCommand = userCommand.toLowerCase();

        for (const skill of skills) {
            for (const trigger of skill.triggers) {
                if (lowerCommand.includes(trigger.toLowerCase())) {
                    // Extract basic args
                    const countMatch = lowerCommand.match(/(\d+)\s*(?:items?|leads?|results?|businesses?)/i);
                    const count = countMatch ? parseInt(countMatch[1]) : 20;

                    return {
                        skillType: skill.type,
                        args: { query: userCommand, count },
                        confidence: 0.6,
                        reason: `Matched trigger: ${trigger}`
                    };
                }
            }
        }

        return { skillType: null, args: {}, confidence: 0, reason: 'No keyword match' };
    }

    /**
     * Execute a skill by type with given args
     * @param {string} skillType - Skill type to execute
     * @param {Object} args - Arguments for the skill
     * @param {Object} deps - Dependencies (browserManager, executor, etc.)
     * @returns {Promise<Object>} - Execution result
     */
    async execute(skillType, args, deps) {
        const SkillClass = this.skills.get(skillType);

        if (!SkillClass) {
            throw new Error(`Skill not found: ${skillType}`);
        }

        const skill = new SkillClass(deps);

        try {
            await skill.initialize();
            const result = await skill.execute(args);
            await skill.cleanup();
            return { success: true, result };
        } catch (error) {
            await skill.cleanup();
            return { success: false, error: error.message };
        }
    }

    /**
     * Route and execute a user command
     * @param {string} userCommand - Natural language command
     * @param {Object} deps - Dependencies
     * @returns {Promise<Object>} - Execution result
     */
    async routeAndExecute(userCommand, deps) {
        console.log(`[orchestrator] Processing: "${userCommand}"`);

        const routing = await this.route(userCommand);
        console.log(`[orchestrator] Routed to: ${routing.skillType} (confidence: ${routing.confidence})`);
        console.log(`[orchestrator] Args: ${JSON.stringify(routing.args)}`);

        if (!routing.skillType) {
            return {
                success: false,
                error: 'No matching skill found',
                routing
            };
        }

        if (routing.confidence < 0.3) {
            return {
                success: false,
                error: 'Low confidence match - please be more specific',
                routing
            };
        }

        const result = await this.execute(routing.skillType, routing.args, deps);
        return { ...result, routing };
    }
}

module.exports = { SkillOrchestrator };
