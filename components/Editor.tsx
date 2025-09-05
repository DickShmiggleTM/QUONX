// FIX: Import `useCallback` from react to resolve "Cannot find name" error.
import React, { useEffect, useRef, useCallback } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, gutter } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { linter, lintGutter, type LintSource, type Diagnostic } from '@codemirror/lint';
import { LintingError } from '../types.ts';

// CodeMirror theme to match the retro aesthetic
const retroTheme = EditorView.theme({
  "&": {
    color: "#0f0",
    backgroundColor: "transparent",
    height: "100%",
    fontSize: '14px',
  },
  ".cm-content": {
    caretColor: "#0f0",
    fontFamily: "'Courier New', monospace",
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "#0f0",
    animation: "cm-blink 1.2s steps(2, start) infinite"
  },
  "&.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "#00ff0033",
  },
  ".cm-gutters": {
    backgroundColor: "#00000050",
    color: "#00ff0080",
    border: "none",
  },
  // Custom wavy underlines for lint errors/warnings
  ".cm-lintRange-error": {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' height='3' width='6'%3E%3Cpath d='M0 2.5 L2 0 L4 2.5 L6 0' stroke='%23ff3333' fill='none' stroke-width='1'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'repeat-x',
    backgroundPosition: 'bottom left',
    paddingBottom: '1px',
  },
  ".cm-lintRange-warning": {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' height='3' width='6'%3E%3Cpath d='M0 2.5 L2 0 L4 2.5 L6 0' stroke='%23ffff33' fill='none' stroke-width='1'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'repeat-x',
    backgroundPosition: 'bottom left',
    paddingBottom: '1px',
  },
  ".cm-tooltip-lint": {
    backgroundColor: '#1a1a1a',
    border: '1px solid #0f0',
  }
}, {dark: true});


interface EditorProps {
  content: string;
  onContentChange: (newContent: string) => void;
  activeFile: string | null;
  lintErrors: LintingError[];
}

const Editor: React.FC<EditorProps> = ({ content, onContentChange, activeFile, lintErrors }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const linterCompartment = useRef(new Compartment());

  const createLintSource = useCallback((errors: LintingError[]): LintSource => {
    return () => {
        const doc = viewRef.current?.state.doc;
        if (!doc) return [];

        // FIX: Add an explicit return type to the map callback to guide TypeScript's inference
        // for the subsequent filter, resolving the type predicate error.
        const diagnostics: Diagnostic[] = errors.map((err): Diagnostic | null => {
            if (err.line > doc.lines) return null;
            const line = doc.line(err.line);
            
            // Highlight the whole line for simplicity, but avoid highlighting empty lines
            const from = line.from;
            const to = line.to;
            if (from === to) return null;

            return { from, to, severity: err.severity, message: err.message };
        }).filter((d): d is Diagnostic => d !== null);
      
        return diagnostics;
    };
  }, []);

  // Initialize CodeMirror view
  useEffect(() => {
    if (!editorRef.current) return;

    const startState = EditorState.create({
      doc: content,
      extensions: [
        lineNumbers(),
        gutter({class: "cm-gutter"}),
        keymap.of(defaultKeymap),
        javascript({ jsx: true, typescript: true }),
        retroTheme,
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            onContentChange(update.state.doc.toString());
          }
        }),
        linterCompartment.current.of(linter(createLintSource(lintErrors))),
        lintGutter(),
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: editorRef.current,
    });
    
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  // We only re-initialize if the container ref changes, which it shouldn't.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle external content changes (e.g., file switched) transactionally
  useEffect(() => {
    if (viewRef.current && content !== viewRef.current.state.doc.toString()) {
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: content,
        },
      });
    }
  }, [content, activeFile]);

  // Update linter diagnostics dynamically when errors change
  useEffect(() => {
    if (viewRef.current) {
        const newLintSource = createLintSource(lintErrors);
        viewRef.current.dispatch({
            effects: linterCompartment.current.reconfigure(linter(newLintSource, {
                delay: 0 // Show diagnostics immediately
            }))
        });
    }
  }, [lintErrors, createLintSource]);


  return (
    <div className="bg-black/50 border border-green-800 p-2 flex flex-col h-full">
      <h2 className="text-sm mb-2 border-b-2 border-green-800 flex-shrink-0">
        EDITOR: {activeFile || 'No file selected'}
      </h2>
      <div className="relative flex-grow overflow-y-auto">
        {activeFile ? (
            <div ref={editorRef} className="h-full w-full"></div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>Select a file to begin editing.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Editor;