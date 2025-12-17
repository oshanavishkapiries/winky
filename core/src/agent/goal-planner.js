/**
 * GoalPlanner - Breaks complex goals into sub-tasks using LLM
 */

class GoalPlanner {
    constructor(llmAdapter) {
        this.llm = llmAdapter;
    }

    /**
     * Plan a complex goal by breaking it into steps
     * @param {string} goal - User's goal
     * @returns {Promise<Object>} - Plan with steps
     */
    async plan(goal) {
        // Check for loop patterns in goal
        const loopMatch = goal.match(/(\d+)\s*(?:times|jobs|posts|items|applications)/i);
        const loopCount = loopMatch ? parseInt(loopMatch[1]) : 0;

        // Use LLM to break down the goal
        const prompt = this.buildPlanningPrompt(goal);

        try {
            const response = await this.llm.generateRaw(prompt);
            const plan = this.parsePlanResponse(response, goal, loopCount);
            return plan;
        } catch (error) {
            // Fallback: return simple single-step plan
            return this.createSimplePlan(goal, loopCount);
        }
    }

    /**
     * Build prompt for goal planning
     */
    buildPlanningPrompt(goal) {
        return `You are a task planner. Break down this goal into clear, actionable steps.

GOAL: "${goal}"

Respond with a JSON object containing:
{
    "steps": [
        { "id": 1, "task": "description of step 1", "isLoop": false },
        { "id": 2, "task": "description of step 2", "isLoop": false },
        // If a step should repeat N times, mark isLoop: true
        { "id": 3, "task": "apply to job", "isLoop": true, "loopCount": 5 }
    ],
    "hasCredentials": true/false,
    "estimatedSteps": number
}

Keep steps simple and atomic. Each step should be achievable in a few browser actions.
Respond ONLY with valid JSON, no explanation.`;
    }

    /**
     * Parse LLM response into plan
     */
    parsePlanResponse(response, goal, loopCount) {
        try {
            // Extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    goal,
                    steps: parsed.steps || [],
                    loopCount: loopCount || parsed.steps?.find(s => s.isLoop)?.loopCount || 0,
                    estimatedSteps: parsed.estimatedSteps || parsed.steps?.length * 5 || 20,
                    hasCredentials: parsed.hasCredentials || false
                };
            }
        } catch (e) {
            // Parse failed
        }

        return this.createSimplePlan(goal, loopCount);
    }

    /**
     * Create a simple fallback plan
     */
    createSimplePlan(goal, loopCount) {
        const steps = [];

        // Detect common patterns and create steps
        const lowerGoal = goal.toLowerCase();

        if (lowerGoal.includes('login')) {
            steps.push({ id: 1, task: 'Navigate to login page', isLoop: false });
            steps.push({ id: 2, task: 'Enter credentials and login', isLoop: false });
        }

        if (lowerGoal.includes('job') || lowerGoal.includes('apply')) {
            steps.push({ id: steps.length + 1, task: 'Navigate to jobs section', isLoop: false });
            steps.push({ id: steps.length + 1, task: 'Search for relevant jobs', isLoop: false });
            if (lowerGoal.includes('easy apply')) {
                steps.push({ id: steps.length + 1, task: 'Filter by Easy Apply', isLoop: false });
            }
            steps.push({
                id: steps.length + 1,
                task: 'Apply to job',
                isLoop: loopCount > 0,
                loopCount: loopCount || 1
            });
        }

        if (lowerGoal.includes('search')) {
            steps.push({ id: steps.length + 1, task: 'Enter search query', isLoop: false });
            steps.push({ id: steps.length + 1, task: 'Review search results', isLoop: false });
        }

        if (lowerGoal.includes('extract') || lowerGoal.includes('find')) {
            steps.push({ id: steps.length + 1, task: 'Extract relevant information', isLoop: false });
        }

        // If no patterns matched, create generic step
        if (steps.length === 0) {
            steps.push({ id: 1, task: goal, isLoop: false });
        }

        return {
            goal,
            steps,
            loopCount,
            estimatedSteps: steps.length * 5,
            hasCredentials: lowerGoal.includes('password') || lowerGoal.includes('login')
        };
    }

    /**
     * Get step by index
     */
    getStep(plan, index) {
        if (plan.steps && plan.steps[index]) {
            return plan.steps[index];
        }
        return null;
    }

    /**
     * Check if plan has more steps
     */
    hasMoreSteps(plan, currentIndex) {
        return plan.steps && currentIndex < plan.steps.length;
    }

    /**
     * Generate context string for current step
     */
    getStepContext(plan, stepIndex, loopIteration = 0) {
        const step = this.getStep(plan, stepIndex);
        if (!step) return '';

        let context = `CURRENT TASK: ${step.task}`;
        context += `\nPROGRESS: Step ${stepIndex + 1} of ${plan.steps.length}`;

        if (step.isLoop && step.loopCount > 1) {
            context += `\nLOOP: Iteration ${loopIteration + 1} of ${step.loopCount}`;
        }

        return context;
    }
}

module.exports = { GoalPlanner };
