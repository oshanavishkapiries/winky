class LLMBrain {
  constructor(adapter, tools, toolDefinitions) {
    this.adapter = adapter;
    this.tools = tools;
    this.toolDefinitions = toolDefinitions;
    this.maxIterations = 15;
    this.iterationCount = 0;
  }

  async execute(objective, page, messages = []) {
    this.iterationCount++;

    if (this.iterationCount > this.maxIterations) {
      return "Error: Maximum iterations reached without fulfilling the objective.";
    }

    if (messages.length === 0) {
      // 1. Generate the tool description dynamically
      const toolsDescription = this.toolDefinitions
        .map(t => `- ${t.function.name}: ${t.function.description}`)
        .join('\n');

      const systemPrompt = {
        role: 'system',
        content: `You are an autonomous Web Agent using Playwright. 
        Your objective: ${objective}
        
        AVAILABLE TOOLS:
        ${toolsDescription}
        
        GUIDELINES:
        1. Always start by calling 'snapshot' to see the current state of the page.
        2. Use the 'ref' ID from the snapshot to interact with elements.
        3. BE AWARE OF OVERLAYS: If a tool fails with a timeout, or if you see a 'dialog' or 'popup' in the snapshot, handle it first (e.g., click 'Not interested', 'Close', or press 'Escape').
        4. After every action, call 'snapshot' again to confirm the result.
        5. If you are stuck or can't see why an action is failing, use 'take_screenshot' to debug visually.
        6. When the task is complete, provide a final answer starting with "FINISH:".`
      };
      
      messages.push(systemPrompt);
      messages.push({ role: 'user', content: "Please begin the task." });
    }

    console.log(`\n--- Brain Iteration ${this.iterationCount} ---`);
    const response = await this.adapter.chat(messages, this.toolDefinitions);
    
    messages.push(response);

    if (response.tool_calls && response.tool_calls.length > 0) {
      for (const call of response.tool_calls) {
        const toolName = call.function.name;
        const args = typeof call.function.arguments === 'string' 
          ? JSON.parse(call.function.arguments) 
          : call.function.arguments;

        console.log(`Action: ${toolName}`, args);

        const result = await this.tools[toolName](args);

        messages.push({
          role: 'tool',
          content: result,
          tool_call_id: call.id
        });
      }
      return this.execute(objective, page, messages);
    }

    return response.content;
  }
}

module.exports = LLMBrain;