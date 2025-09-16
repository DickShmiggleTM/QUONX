import { LintingError } from '../types.ts';

/**
 * @class LintingService
 * @description A service for linting code.
 */
export class LintingService {
  /**
   * @function lint
   * @description Lints a string of code and returns an array of errors.
   * @param {string} code - The code to lint.
   * @returns {LintingError[]} An array of linting errors.
   */
  public lint(code: string): LintingError[] {
    const errors: LintingError[] = [];
    const lines = code.split('\n');
    const declaredVars = new Set<string>();
    const usedVars = new Set<string>();

    lines.forEach((line, index) => {
      const lineNumber = index + 1;

      // Check for long lines
      if (line.length > 120) {
        errors.push({
          line: lineNumber,
          column: 121,
          message: 'Line exceeds 120 characters.',
          severity: 'warning',
        });
      }

      // Check for console.log statements
      if (/\bconsole\.log\b/.test(line)) {
        errors.push({
          line: lineNumber,
          column: line.indexOf('console.log') + 1,
          message: 'Avoid using console.log in production code.',
          severity: 'warning',
        });
      }
      
      // Simple unused variable check
      const declarationMatch = line.match(/(?:const|let|var)\s+([a-zA-Z0-9_]+)/);
      if (declarationMatch) {
          declaredVars.add(declarationMatch[1]);
      }

      // Find usages
      const usageMatches = line.matchAll(/([a-zA-Z0-9_]+)/g);
      for(const match of usageMatches) {
          // crude check to avoid marking declarations as usage
          if(!line.substring(0, match.index ?? 0).match(/(?:const|let|var)\s+$/)) {
             usedVars.add(match[0]);
          }
      }
    });
    
    // This is a very basic check and will have false positives, but it's a good simulation
    // A real linter would use an AST.
    declaredVars.forEach(v => {
        if (!usedVars.has(v)) {
            // Find the line where it was declared to report the error
            const lineIndex = lines.findIndex(l => l.includes(` ${v}`));
            if (lineIndex !== -1) {
                errors.push({
                    line: lineIndex + 1,
                    column: lines[lineIndex].indexOf(v) + 1,
                    message: `'${v}' is declared but its value is never read.`,
                    severity: 'warning',
                });
            }
        }
    });

    return errors;
  }
}
