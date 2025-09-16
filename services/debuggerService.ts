import { DebuggerState } from '../types.ts';

/**
 * @callback UpdateStateCallback
 * @description A callback function to update the debugger state.
 * @param {(prevState: DebuggerState) => DebuggerState} updater - A function that takes the previous state and returns the new state.
 * @returns {void}
 */
type UpdateStateCallback = (updater: (prevState: DebuggerState) => DebuggerState) => void;

/**
 * @class DebuggerService
 * @description A service for simulating a debugger.
 */
export class DebuggerService {
    private updateState: UpdateStateCallback;
    private executionInterval: number | null = null;
    private codeLines: string[] = [];
    private breakpoints: Map<number, string> = new Map();
    private currentFilePath: string | null = null;

    /**
     * @constructor
     * @param {UpdateStateCallback} updateState - A callback function to update the debugger state.
     */
    constructor(updateState: UpdateStateCallback) {
        this.updateState = updateState;
    }

    /**
     * @function start
     * @description Starts the debugger.
     * @param {string} code - The code to debug.
     * @param {Map<number, string>} breakpoints - A map of breakpoints.
     * @param {string | null} filePath - The path of the file being debugged.
     * @returns {void}
     */
    public start(code: string, breakpoints: Map<number, string>, filePath: string | null) {
        this.stop();
        this.codeLines = code.split('\n');
        this.breakpoints = breakpoints;
        this.currentFilePath = filePath;
        this.updateState(prev => ({
            ...prev,
            isActive: true,
            isPaused: false,
            currentLine: 0,
            scope: {},
            callStack: [{ function: '(main)', file: filePath || 'unknown', line: 1 }]
        }));
        this.resume();
    }

    /**
     * @function stop
     * @description Stops the debugger.
     * @returns {void}
     */
    public stop() {
        if (this.executionInterval) {
            clearInterval(this.executionInterval);
            this.executionInterval = null;
        }
        this.updateState(prev => ({
            ...prev,
            isActive: false,
            isPaused: false,
            currentLine: null,
            scope: {},
            callStack: []
        }));
    }
    
    /**
     * @function resume
     * @description Resumes the debugger.
     * @returns {void}
     */
    public resume() {
        this.updateState(prev => ({ ...prev, isPaused: false }));
        this.executionInterval = setInterval(() => this.stepOver(), 500);
    }
    
    /**
     * @function pause
     * @description Pauses the debugger.
     * @returns {void}
     */
    public pause() {
        if (this.executionInterval) {
            clearInterval(this.executionInterval);
            this.executionInterval = null;
        }
        this.updateState(prev => ({ ...prev, isPaused: true }));
    }

    /**
     * @function stepOver
     * @description Steps over the current line of code.
     * @returns {void}
     */
    public stepOver() {
        this.updateState(prev => {
            if (!prev.isActive || prev.currentLine === null || prev.currentLine >= this.codeLines.length) {
                this.stop();
                return prev;
            }

            const nextLine = prev.currentLine + 1;
            const lineContent = this.codeLines[prev.currentLine];
            
            // Simple scope simulation with regex
            const newScope = { ...prev.scope };
            const assignmentMatch = lineContent.match(/(?:let|const|var)\s+(\w+)\s*=\s*(.+);?/);
            if (assignmentMatch) {
                try {
                    // VERY UNSAFE, but fine for a simulation.
                    const value = new Function(`return ${assignmentMatch[2]}`)();
                    newScope[assignmentMatch[1]] = value;
                } catch (e) {
                    // Ignore parsing errors for simulation
                }
            }

            const breakpointCondition = this.breakpoints.get(nextLine);
            if (breakpointCondition !== undefined) {
                let conditionMet = false;
                if (breakpointCondition === '') {
                    conditionMet = true; // Unconditional breakpoint
                } else {
                    conditionMet = this.evaluateCondition(breakpointCondition, newScope);
                }

                if (conditionMet) {
                    this.pause();
                    return { ...prev, isPaused: true, currentLine: nextLine, scope: newScope };
                }
            }
            
            return { ...prev, currentLine: nextLine, scope: newScope };
        });
    }

    /**
     * @function updateBreakpoints
     * @description Updates the breakpoints.
     * @param {Map<number, string>} newBreakpoints - The new breakpoints.
     * @returns {void}
     */
    public updateBreakpoints(newBreakpoints: Map<number, string>) {
        this.breakpoints = newBreakpoints;
    }

    /**
     * @function evaluateCondition
     * @description Evaluates a breakpoint condition.
     * @param {string} condition - The condition to evaluate.
     * @param {Record<string, any>} scope - The current scope.
     * @returns {boolean} Whether the condition is met.
     * @private
     */
    private evaluateCondition(condition: string, scope: Record<string, any>): boolean {
        try {
            // Create a function with the scope variables in its context
            const scopeKeys = Object.keys(scope);
            const scopeValues = Object.values(scope);
            const evaluator = new Function(...scopeKeys, `return ${condition};`);
            return !!evaluator(...scopeValues);
        } catch (e) {
            console.error(`Error evaluating breakpoint condition "${condition}":`, e);
            return false; // Fail-safe: don't pause on error
        }
    }
}
