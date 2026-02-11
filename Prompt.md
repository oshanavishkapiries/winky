in this project i try to build a browser automation agent with fully browser control and automation.

now i explain my unique browser agent idea. 

i want to use "playwright" as a browser automation engine.
and "@agentclientprotocol/sdk" as a browser automation client protocol.
and "open-ai , open-router" as the LLM providers in initial version.

i want to create "config file" for all configuration controls. like LLM provider 
playwright settings ... 

i like define browser path manualy so we can use light weight "playwright-core" like library 

i like this project has "data" name folder for all data files. like cookies, history, cache, etc.

i want to folder "data/logs/workflow" => for full workflow logs ( browser actions + LLM actions )
"data/logs/llm" => for full LLM logs ( LLM actions )
"data/logs/browser" => for full browser logs ( browser actions )

i want to "data/browser/profiles" => for all browser profiles
i want to "data/browser/profiles/{profile_name}" => for all browser profiles data

... above is my high level idea for this project. i want to help from you  to build 
folder structure and action plan to implimant this project ( action plan with phases )

i mostly like all codebase flow "SOLID principles" and "clean code" and "readable code" and "maintainable code" so consider this very important for me.

C:\Users\Oshan\.gemini\antigravity\brain\b8c12b0f-2cf1-4a5a-aa24-037961263943\implementation_plan.md.resolved