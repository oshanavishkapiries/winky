/**
 * AgentMemory - Memory management for browser automation agent
 * Provides short-term, working, and long-term memory
 */

class AgentMemory {
    constructor() {
        // Short-term memory: Recent actions (sliding window)
        this.shortTerm = [];
        this.shortTermLimit = 10;

        // Working memory: Current task state
        this.workingMemory = {
            currentGoal: null,
            currentStep: 0,
            totalSteps: 0,
            stepResults: [],
            loopCount: 0,
            loopTarget: 0
        };

        // Long-term memory: Facts learned during session
        this.longTerm = new Map();

        // Observations: Things noticed on pages
        this.observations = [];
    }

    // =========================================================================
    // SHORT-TERM MEMORY (Recent Actions)
    // =========================================================================

    /**
     * Add action to short-term memory
     * @param {Object} action
     */
    addAction(action) {
        this.shortTerm.push({
            timestamp: Date.now(),
            ...action
        });

        // Keep only last N actions
        if (this.shortTerm.length > this.shortTermLimit) {
            this.shortTerm.shift();
        }
    }

    /**
     * Get recent actions
     * @param {number} n - Number of actions to get
     * @returns {Array}
     */
    getRecentActions(n = 5) {
        return this.shortTerm.slice(-n);
    }

    /**
     * Check if action was recently performed
     * @param {string} actionType
     * @param {string} elementId
     * @returns {boolean}
     */
    wasRecentlyDone(actionType, elementId) {
        return this.shortTerm.slice(-3).some(
            a => a.action_type === actionType && a.element_id === elementId
        );
    }

    // =========================================================================
    // WORKING MEMORY (Current Task State)
    // =========================================================================

    /**
     * Set current goal/task
     * @param {Object} plan - Goal plan with steps
     */
    setGoalPlan(plan) {
        this.workingMemory.currentGoal = plan.goal;
        this.workingMemory.totalSteps = plan.steps?.length || 0;
        this.workingMemory.currentStep = 0;
        this.workingMemory.stepResults = [];
        this.workingMemory.steps = plan.steps || [];
    }

    /**
     * Advance to next step
     * @param {Object} result - Result of current step
     */
    advanceStep(result) {
        this.workingMemory.stepResults.push(result);
        this.workingMemory.currentStep++;
    }

    /**
     * Get current step info
     * @returns {Object}
     */
    getCurrentStep() {
        const { currentStep, steps } = this.workingMemory;
        if (steps && steps[currentStep]) {
            return {
                index: currentStep,
                total: steps.length,
                task: steps[currentStep],
                progress: `${currentStep + 1}/${steps.length}`
            };
        }
        return null;
    }

    /**
     * Set loop tracking for repetitive tasks
     * @param {number} target - How many times to loop
     */
    setLoopTarget(target) {
        this.workingMemory.loopTarget = target;
        this.workingMemory.loopCount = 0;
    }

    /**
     * Increment loop count
     * @returns {Object} - Current loop state
     */
    incrementLoop() {
        this.workingMemory.loopCount++;
        return {
            current: this.workingMemory.loopCount,
            target: this.workingMemory.loopTarget,
            remaining: this.workingMemory.loopTarget - this.workingMemory.loopCount,
            complete: this.workingMemory.loopCount >= this.workingMemory.loopTarget
        };
    }

    /**
     * Get loop progress
     * @returns {Object}
     */
    getLoopProgress() {
        return {
            current: this.workingMemory.loopCount,
            target: this.workingMemory.loopTarget,
            remaining: this.workingMemory.loopTarget - this.workingMemory.loopCount
        };
    }

    // =========================================================================
    // LONG-TERM MEMORY (Persistent Facts)
    // =========================================================================

    /**
     * Remember a fact
     * @param {string} key
     * @param {any} value
     */
    remember(key, value) {
        this.longTerm.set(key, {
            value,
            timestamp: Date.now()
        });
    }

    /**
     * Recall a fact
     * @param {string} key
     * @returns {any}
     */
    recall(key) {
        const item = this.longTerm.get(key);
        return item ? item.value : null;
    }

    /**
     * Check if fact is known
     * @param {string} key
     * @returns {boolean}
     */
    knows(key) {
        return this.longTerm.has(key);
    }

    /**
     * Get all known facts
     * @returns {Object}
     */
    getAllFacts() {
        const facts = {};
        for (const [key, item] of this.longTerm) {
            facts[key] = item.value;
        }
        return facts;
    }

    // =========================================================================
    // OBSERVATIONS
    // =========================================================================

    /**
     * Add observation about the page
     * @param {string} observation
     */
    observe(observation) {
        this.observations.push({
            text: observation,
            timestamp: Date.now()
        });

        // Keep last 20 observations
        if (this.observations.length > 20) {
            this.observations.shift();
        }
    }

    /**
     * Get recent observations
     * @param {number} n
     * @returns {string[]}
     */
    getObservations(n = 5) {
        return this.observations.slice(-n).map(o => o.text);
    }

    // =========================================================================
    // CONTEXT GENERATION (For LLM)
    // =========================================================================

    /**
     * Generate memory context for LLM prompt
     * @returns {string}
     */
    getContextForLLM() {
        const parts = [];

        // Goal progress
        const step = this.getCurrentStep();
        if (step) {
            parts.push(`CURRENT PROGRESS: Step ${step.progress} - "${step.task}"`);
        }

        // Loop progress
        const loop = this.getLoopProgress();
        if (loop.target > 0) {
            parts.push(`LOOP PROGRESS: ${loop.current}/${loop.target} completed, ${loop.remaining} remaining`);
        }

        // Known facts
        const facts = this.getAllFacts();
        if (Object.keys(facts).length > 0) {
            const factList = Object.entries(facts)
                .map(([k, v]) => `- ${k}: ${v}`)
                .join('\n');
            parts.push(`KNOWN FACTS:\n${factList}`);
        }

        // Recent observations
        const obs = this.getObservations(3);
        if (obs.length > 0) {
            parts.push(`OBSERVATIONS:\n${obs.map(o => `- ${o}`).join('\n')}`);
        }

        // Recent actions summary
        const recent = this.getRecentActions(3);
        if (recent.length > 0) {
            const actionList = recent
                .map(a => `- ${a.action_type}${a.element_id ? ` on ${a.element_id}` : ''}`)
                .join('\n');
            parts.push(`RECENT ACTIONS:\n${actionList}`);
        }

        return parts.length > 0 ? parts.join('\n\n') : '';
    }

    /**
     * Reset all memory
     */
    reset() {
        this.shortTerm = [];
        this.workingMemory = {
            currentGoal: null,
            currentStep: 0,
            totalSteps: 0,
            stepResults: [],
            loopCount: 0,
            loopTarget: 0
        };
        this.longTerm.clear();
        this.observations = [];
    }
}

module.exports = { AgentMemory };
