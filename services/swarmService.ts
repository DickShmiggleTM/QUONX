import { generateContent } from './geminiService.ts';
import { SwarmPlanStep, SwarmTaskStatus, AgentRole, RoleModels, Agent } from '../types.ts';

/**
 * @callback ToolExecutor
 * @description A function that executes a tool.
 * @param {string} name - The name of the tool to execute.
 * @param {any} args - The arguments for the tool.
 * @returns {Promise<string>} The result of the tool execution.
 */
type ToolExecutor = (name: string, args: any) => Promise<string>;
/**
 * @callback SwarmUpdateCallback
 * @description A callback function to update the swarm task status.
 * @param {Partial<SwarmTaskStatus>} update - The partial update to apply to the swarm task status.
 * @returns {void}
 */
type SwarmUpdateCallback = (update: Partial<SwarmTaskStatus>) => void;

// --- AGENT DEFINITIONS ---

/**
 * @class PlannerAgent
 * @description An agent that creates a plan for a given goal.
 */
class PlannerAgent {
    constructor(private model: string) {}
    
    /**
     * @function createPlan
     * @description Creates a plan for a given goal.
     * @param {string} goal - The goal to create a plan for.
     * @param {Agent[]} activeAgents - The list of active agents.
     * @returns {Promise<SwarmPlanStep[]>} The created plan.
     */
    async createPlan(goal: string, activeAgents: Agent[]): Promise<SwarmPlanStep[]> {
        const availableAgentsDesc = activeAgents
            .filter(a => a.role !== 'Planner' && a.role !== 'SynthesizerAgent' && a.role !== 'Coordinator')
            .map(a => `- ${a.role}: ${a.description}`)
            .join('\n');

        const systemInstruction = `You are an expert AI software architect. Your job is to take a high-level user goal and break it down into a detailed, step-by-step plan of executable actions.
The available standard actions are: 'designComponent', 'generateComponentCode', 'generateApiCode', 'generateTests', 'writeDocumentation', 'readFile', 'writeFile', 'editFile', 'createDirectory', 'final_summary'.
For custom, user-defined agents, you can delegate tasks by setting the 'action' to 'custom_agent_action' and 'agent_role' to the agent's role name. The 'goal' for that step should be the instruction for the agent.
Available Custom Agents:
${availableAgentsDesc}

Each step must be a single, discrete action. For tasks that match a standard action (like designing or generating tests), use that action.
The final step must ALWAYS be 'final_summary'.
You must respond with ONLY a valid JSON array of plan steps. Do not include any other text or markdown.`;

        const prompt = `Create a plan for this goal: "${goal}"`;
        const response = await generateContent({ model: this.model, prompt, systemInstruction, json: true });

        if (Array.isArray(response)) {
            return response.map((step, index) => ({ ...step, step: index + 1, status: 'pending' }));
        }
        throw new Error(`Planner failed to create a valid plan. Response: ${JSON.stringify(response)}`);
    }
}

/**
 * @class DesignerAgent
 * @description An agent that designs software components.
 */
class DesignerAgent {
    constructor(private model: string) {}
    /**
     * @function design
     * @description Designs a software component based on a goal.
     * @param {string} goal - The goal to design for.
     * @returns {Promise<string>} The design specification.
     */
    async design(goal: string): Promise<string> {
        const systemInstruction = `You are a principal software designer. Take the user's goal and produce a detailed technical specification.
Describe the components, their props, state, and file paths. For APIs, define the endpoint, method, request body, and response.
Your response should be a clear, concise markdown document.`;
        const prompt = `Design the components and APIs for this goal: "${goal}"`;
        return await generateContent({ model: this.model, prompt, systemInstruction });
    }
}

/**
 * @class CodeAgent
 * @description An agent that generates API code.
 */
class CodeAgent {
    constructor(private model: string) {}
    /**
     * @function generateApi
     * @description Generates API code based on a design.
     * @param {string} design - The design to generate code for.
     * @returns {Promise<string>} The generated API code.
     */
    async generateApi(design: string): Promise<string> {
        const systemInstruction = `You are an expert backend developer. Write a complete, production-ready API file based on the technical design.
Your response MUST be ONLY the complete code. Do not add any commentary, explanations, or markdown formatting.`;
        const prompt = `Write the API code based on this design:\n\n${design}`;
        return await generateContent({ model: this.model, prompt, systemInstruction });
    }
}

/**
 * @class UIAgent
 * @description An agent that generates UI component code.
 */
class UIAgent {
    constructor(private model: string) {}
    /**
     * @function generateComponent
     * @description Generates UI component code based on a design.
     * @param {string} design - The design to generate code for.
     * @returns {Promise<string>} The generated UI component code.
     */
    async generateComponent(design: string): Promise<string> {
        const systemInstruction = `You are an expert frontend developer specializing in React and TypeScript. Write a complete, production-ready component file based on the technical design.
Your response MUST be ONLY the complete code for the component file. Do not add any commentary, explanations, or markdown formatting.`;
        const prompt = `Write the React component code based on this design:\n\n${design}`;
        return await generateContent({ model: this.model, prompt, systemInstruction });
    }
}

/**
 * @class TestingAgent
 * @description An agent that generates tests for code.
 */
class TestingAgent {
    constructor(private model: string) {}
    /**
     * @function generateTests
     * @description Generates tests for code based on a goal.
     * @param {string} code - The code to generate tests for.
     * @param {string} goal - The goal to generate tests for.
     * @returns {Promise<string>} The generated test code.
     */
    async generateTests(code: string, goal: string): Promise<string> {
        const systemInstruction = `You are an expert QA engineer. Write comprehensive unit or component tests for the given code, covering the requirements of the original goal.
Use a modern testing framework like Jest or React Testing Library.
Your response MUST be ONLY the complete code for the test file. Do not add any commentary or markdown.`;
        const prompt = `The original goal was: "${goal}". Write tests for the following code:\n\n\`\`\`\n${code}\n\`\`\``;
        return await generateContent({ model: this.model, prompt, systemInstruction });
    }
}

/**
 * @class DocumentAgent
 * @description An agent that writes documentation for code.
 */
class DocumentAgent {
    constructor(private model: string) {}
    /**
     * @function writeDocs
     * @description Writes documentation for code based on a goal.
     * @param {string} code - The code to write documentation for.
     * @param {string} goal - The goal to write documentation for.
     * @returns {Promise<string>} The generated documentation.
     */
    async writeDocs(code: string, goal: string): Promise<string> {
        const systemInstruction = `You are an expert technical writer. Create clear, concise documentation for the provided code in Markdown format.
Explain the component's purpose, props, and usage examples based on the original goal.
Your response MUST be ONLY the markdown documentation.`;
        const prompt = `The original goal was: "${goal}". Write documentation for the following code:\n\n\`\`\`\n${code}\n\`\`\``;
        return await generateContent({ model: this.model, prompt, systemInstruction });
    }
}

/**
 * @class ReviewerAgent
 * @description An agent that reviews code.
 */
class ReviewerAgent {
    constructor(private model: string) {}
    /**
     * @function review
     * @description Reviews an artifact based on a description.
     * @param {string} artifact - The artifact to review.
     * @param {string} description - The description of the artifact.
     * @returns {Promise<{ passed: boolean; feedback: string }>} The review result.
     */
    async review(artifact: string, description: string): Promise<{ passed: boolean; feedback: string }> {
        const systemInstruction = `You are a principal engineer and expert code reviewer. Your job is to check a generated artifact for correctness, completeness, and quality based on its requirements.
Respond with a JSON object: { "passed": boolean, "feedback": "your review notes" }.
Be critical. If there are potential bugs, syntax errors, or the artifact doesn't meet the description, fail the review.`;
        const prompt = `Review the following artifact based on the description.\nDescription: "${description}"\nArtifact:\n\`\`\`\n${artifact}\n\`\`\``;
        const response = await generateContent({ model: this.model, prompt, systemInstruction, json: true });
        if (response && typeof response.passed === 'boolean') {
            return response;
        }
        return { passed: false, feedback: `Reviewer agent failed to provide a valid review. Raw response: ${JSON.stringify(response)}` };
    }
}

/**
 * @class SynthesizerAgent
 * @description An agent that summarizes the results of a task.
 */
class SynthesizerAgent {
    constructor(private model: string) {}
    /**
     * @function summarize
     * @description Summarizes the results of a task.
     * @param {string} goal - The original goal of the task.
     * @param {SwarmPlanStep[]} plan - The plan that was executed.
     * @returns {Promise<string>} The summary.
     */
    async summarize(goal: string, plan: SwarmPlanStep[]): Promise<string> {
        const systemInstruction = `You are the user-facing AI assistant. Your job is to provide a concise, clear summary of a completed task.
Explain what you did and list any files that were created or modified.`;
        const completedSteps = plan.filter(p => p.status === 'complete');
        const prompt = `The user's original goal was: "${goal}".
The following steps were successfully executed:
${completedSteps.map(s => `- Action: ${s.action}, Path: ${s.path || 'N/A'}, Result: ${s.result}`).join('\n')}

Provide a summary for the user.`;
        return await generateContent({ model: this.model, prompt, systemInstruction });
    }
}

/**
 * @class CustomAgent
 * @description A custom agent that can be defined by the user.
 */
class CustomAgent {
    constructor(private model: string, private description: string) {}
    /**
     * @function execute
     * @description Executes a custom task.
     * @param {string} goal - The goal to execute.
     * @returns {Promise<string>} The result of the execution.
     */
    async execute(goal: string): Promise<string> {
        const systemInstruction = `You are a specialized AI agent. Your role is: "${this.description}".
You must perform the task described in the prompt and return the result.
If you are writing code or a file, return ONLY the file content. Do not add commentary.
If you are performing analysis, return a clear summary of your findings.`;
        const prompt = `Execute this task: "${goal}"`;
        return await generateContent({ model: this.model, prompt, systemInstruction });
    }
}

// --- ORCHESTRATOR ---

/**
 * @class SwarmCoordinator
 * @description An orchestrator for the swarm of agents.
 */
export class SwarmCoordinator {
    private agents: Record<string, any> = {};
    private sharedState: Record<string, any> = {};
    private models: RoleModels;

    /**
     * @constructor
     * @param {RoleModels} models - The models to use for each agent role.
     * @param {ToolExecutor} toolExecutor - A function to execute tools.
     * @param {SwarmUpdateCallback} onUpdate - A callback function to update the swarm task status.
     */
    constructor(
        models: RoleModels,
        private toolExecutor: ToolExecutor,
        private onUpdate: SwarmUpdateCallback
    ) {
        this.models = models;
    }

    /**
     * @function log
     * @description Logs a message to the swarm task status.
     * @param {AgentRole | string} role - The role of the agent logging the message.
     * @param {string} message - The message to log.
     * @private
     */
    private log(role: AgentRole | string, message: string) {
        this.onUpdate({ logs: [{ role, message, timestamp: new Date().toLocaleTimeString() }] });
    }

    /**
     * @function run
     * @description Runs a swarm task.
     * @param {string} goal - The goal of the task.
     * @param {Agent[]} activeAgents - The list of active agents.
     * @returns {Promise<{ success: boolean; finalMessage: string }>} The result of the task.
     */
    public async run(goal: string, activeAgents: Agent[]): Promise<{ success: boolean; finalMessage: string }> {
        this.sharedState = {};
        this.agents = {};

        for (const agent of activeAgents) {
            const modelName = this.models[agent.model];
            switch (agent.role) {
                case 'Planner': this.agents.Planner = new PlannerAgent(modelName); break;
                case 'Designer': this.agents.Designer = new DesignerAgent(modelName); break;
                case 'CodeAgent': this.agents.CodeAgent = new CodeAgent(modelName); break;
                case 'UIAgent': this.agents.UIAgent = new UIAgent(modelName); break;
                case 'ReviewerAgent': this.agents.ReviewerAgent = new ReviewerAgent(modelName); break;
                case 'TestingAgent': this.agents.TestingAgent = new TestingAgent(modelName); break;
                case 'DocumentAgent': this.agents.DocumentAgent = new DocumentAgent(modelName); break;
                case 'SynthesizerAgent': this.agents.SynthesizerAgent = new SynthesizerAgent(modelName); break;
                default:
                    if (agent.isCustom) {
                        this.agents[agent.role] = new CustomAgent(modelName, agent.description);
                    }
                    break;
            }
        }
        this.agents.Coordinator = this;
        
        this.onUpdate({ goal, status: 'planning', plan: [], logs: [] });
        this.log('Coordinator', `Starting new task with ${activeAgents.length} active agents. Goal: ${goal}`);
        
        let plan: SwarmPlanStep[];
        try {
            if (!this.agents.Planner) throw new Error("Planner agent is not active.");
            plan = await this.agents.Planner.createPlan(goal, activeAgents);
            this.onUpdate({ plan });
            this.log('Planner', `Successfully created a ${plan.length}-step plan.`);
        } catch (error) {
            return this.failTask(`Planner failed to create a plan: ${error}`);
        }

        for (let i = 0; i < plan.length; i++) {
            const step = plan[i];
            this.updateStepStatus(i, 'executing');
            try {
                const result = await this.executeStep(step, goal);
                this.updateStepStatus(i, 'complete', result);
                this.log('Coordinator', `Step ${step.step} (${step.action}) completed successfully.`);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.updateStepStatus(i, 'error', errorMessage);
                return this.failTask(`Step ${step.step} (${step.action}) failed: ${errorMessage}`);
            }
        }
        
        this.onUpdate({ status: 'summarizing' });
        this.log('Coordinator', `All steps complete. Synthesizing final response.`);
        if (!this.agents.SynthesizerAgent) return this.failTask("Synthesizer agent is not active.");
        const summary = await this.agents.SynthesizerAgent.summarize(goal, plan);
        this.log('SynthesizerAgent', `Final summary generated.`);
        
        this.onUpdate({ status: 'finished' });
        return { success: true, finalMessage: summary };
    }

    /**
     * @function executeStep
     * @description Executes a single step of the plan.
     * @param {SwarmPlanStep} step - The step to execute.
     * @param {string} overallGoal - The overall goal of the task.
     * @returns {Promise<string>} The result of the step execution.
     * @private
     */
    private async executeStep(step: SwarmPlanStep, overallGoal: string): Promise<string> {
        const executeAndReview = async (generationPromise: Promise<string>, reviewDesc: string, filePath: string) => {
            const artifact = await generationPromise;
            if (!this.agents.ReviewerAgent) {
                this.log('Coordinator', 'Reviewer agent is inactive. Skipping review.');
            } else {
                this.onUpdate({ status: 'reviewing' });
                this.log('ReviewerAgent', `Reviewing artifact for: ${reviewDesc}`);
                const review = await this.agents.ReviewerAgent.review(artifact, reviewDesc);
                this.log('ReviewerAgent', `Review ${review.passed ? 'Passed' : 'Failed'}. Feedback: ${review.feedback}`);
                if (!review.passed) throw new Error(`Review failed: ${review.feedback}`);
            }
            this.onUpdate({ status: 'executing' });
            return await this.toolExecutor('writeFile', { path: filePath, content: artifact });
        };
        
        switch (step.action) {
            case 'designComponent':
                if (!this.agents.Designer) throw new Error("Designer agent is not active.");
                this.onUpdate({ status: 'designing' });
                this.log('Designer', `Designing: ${step.goal}`);
                const design = await this.agents.Designer.design(step.goal!);
                this.sharedState.lastDesign = design;
                return `Design created successfully.`;

            case 'generateComponentCode':
                if (!this.agents.UIAgent) throw new Error("UIAgent is not active.");
                if (!this.sharedState.lastDesign) throw new Error("No design available to generate UI component code.");
                if (!step.path) throw new Error("No file path provided for the new component.");
                this.log('UIAgent', `Generating UI component code for path: ${step.path}`);
                this.sharedState.lastCodePath = step.path;
                return await executeAndReview(
                    this.agents.UIAgent.generateComponent(this.sharedState.lastDesign),
                    `Reviewing UI component code for ${step.path}`,
                    step.path
                );

            case 'generateApiCode':
                if (!this.agents.CodeAgent) throw new Error("CodeAgent is not active.");
                if (!this.sharedState.lastDesign) throw new Error("No design available to generate API code.");
                if (!step.path) throw new Error("No file path provided for the new API route.");
                this.log('CodeAgent', `Generating API code for path: ${step.path}`);
                this.sharedState.lastCodePath = step.path;
                return await executeAndReview(
                    this.agents.CodeAgent.generateApi(this.sharedState.lastDesign),
                    `Reviewing API code for ${step.path}`,
                    step.path
                );
            
            case 'generateTests':
                if (!this.agents.TestingAgent) throw new Error("TestingAgent is not active.");
                const codePath = step.code_path || this.sharedState.lastCodePath;
                if (!codePath) throw new Error("No source code file path specified or found from previous step to generate tests for.");
                if (!step.path) throw new Error("No file path provided for the new test file.");
                this.onUpdate({ status: 'testing' });
                this.log('TestingAgent', `Generating tests for ${codePath}`);
                const codeContent = await this.toolExecutor('readFile', { path: codePath });
                if (codeContent.startsWith('Error:')) throw new Error(codeContent);
                return await executeAndReview(
                    this.agents.TestingAgent.generateTests(codeContent, step.goal || overallGoal),
                    `Reviewing generated tests for ${step.path}`,
                    step.path
                );

            case 'writeDocumentation':
                 if (!this.agents.DocumentAgent) throw new Error("DocumentAgent is not active.");
                const docCodePath = step.code_path || this.sharedState.lastCodePath;
                if (!docCodePath) throw new Error("No source code file path specified or found from previous step to document.");
                if (!step.path) throw new Error("No file path provided for the new documentation file.");
                this.onUpdate({ status: 'documenting' });
                this.log('DocumentAgent', `Generating documentation for ${docCodePath}`);
                const docCodeContent = await this.toolExecutor('readFile', { path: docCodePath });
                if (docCodeContent.startsWith('Error:')) throw new Error(docCodeContent);
                return await executeAndReview(
                    this.agents.DocumentAgent.writeDocs(docCodeContent, step.goal || overallGoal),
                    `Reviewing generated documentation for ${step.path}`,
                    step.path
                );

            case 'custom_agent_action':
                const agentRole = step.agent_role!;
                const agent = this.agents[agentRole];
                if (!agent) throw new Error(`Agent '${agentRole}' is not active or does not exist.`);
                this.log(agentRole, `Executing custom task: ${step.goal}`);
                if (step.path) { // Assumes file content generation
                    return await executeAndReview(
                        agent.execute(step.goal!),
                        `Reviewing artifact from ${agentRole} for goal: ${step.goal}`,
                        step.path
                    );
                } else { // Assumes analysis or action without file output
                    return await agent.execute(step.goal!);
                }

            case 'final_summary':
                return "Summary will be generated after all steps.";

            default:
                this.log('Coordinator', `Executing tool '${step.action}'`);
                const { path, instruction, content_description } = step;
                return await this.toolExecutor(step.action, { path, instruction, content: content_description });
        }
    }

    /**
     * @function failTask
     * @description Fails a swarm task.
     * @param {string} message - The reason for the failure.
     * @returns {{ success: boolean, finalMessage: string }} The result of the task.
     * @private
     */
    private failTask(message: string): { success: boolean, finalMessage: string } {
        this.log('Coordinator', message);
        this.onUpdate({ status: 'failed' });
        return { success: false, finalMessage: `I have failed the task. Details: ${message}` };
    }

    /**
     * @function updateStepStatus
     * @description Updates the status of a step in the plan.
     * @param {number} index - The index of the step to update.
     * @param {SwarmPlanStep['status']} status - The new status of the step.
     * @param {string} [result] - The result of the step execution.
     * @private
     */
    private updateStepStatus(index: number, status: SwarmPlanStep['status'], result?: string) {
        this.onUpdate({
            plan: [{ ...this.onUpdate.arguments[0].plan[index], step: index + 1, status, ...(result && { result }) }] as any,
        });
    }
}