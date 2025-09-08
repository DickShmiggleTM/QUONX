// FIX: Import `useCallback` from react to resolve "Cannot find name" error.
import React, { useEffect, useRef, useCallback } from 'react';
// FIX: Import RangeSet and Range for GutterMarker management.
import { EditorState, Compartment, StateField, StateEffect, RangeSet, Range } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, gutter, GutterMarker, Decoration } from '@codemirror/view';
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
  ".cm-breakpoint-gutter": {
      width: "1em",
  },
  ".cm-debugger-line": {
      backgroundColor: "#f59e0b33" // amber-500 with opacity
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
  breakpoints: Map<number, string>;
  onSetBreakpoint: (line: number, condition: string | null) => void;
  debuggerLine: number | null;
}

// --- Breakpoint Gutter Logic ---
class BreakpointGutterMarker extends GutterMarker {
  constructor(readonly conditional: boolean) { super(); }
  toDOM() {
    const marker = document.createElement("div");
    marker.style.width = "8px";
    marker.style.height = "8px";
    marker.style.borderRadius = "50%";
    marker.style.backgroundColor = this.conditional ? "#f59e0b" : "#ef4444";
    marker.title = this.conditional ? "Conditional breakpoint" : "Breakpoint";
    return marker;
  }
}

const breakpointEffect = StateEffect.define<Map<number, string>>();
// FIX: The breakpointMarkers state field was incorrectly defined to use Decorations instead of GutterMarkers.
// This caused type errors when creating the gutter and updating markers.
// The field is now correctly typed as StateField<RangeSet<GutterMarker>> and uses RangeSet.empty.
// The update logic now correctly builds a new RangeSet of GutterMarkers when the effect is dispatched.
const breakpointMarkers = StateField.define<RangeSet<GutterMarker>>({
    create: () => RangeSet.empty,
    update(markers, tr) {
        markers = markers.map(tr.changes);
        for (const e of tr.effects) {
            if (e.is(breakpointEffect)) {
                const newBreakpoints = e.value;
                const markerRanges: Range<GutterMarker>[] = [];
                for (const [lineNum, condition] of newBreakpoints.entries()) {
                    // Ensure line number is valid for the document
                    if (lineNum > 0 && lineNum <= tr.newDoc.lines) {
                        const line = tr.newDoc.line(lineNum);
                        // FIX: The .range() method may not exist on GutterMarker depending on the CodeMirror version or project setup.
                        // Instead of calling marker.range(), we create a Range object implicitly by passing a structured object to RangeSet.of().
                        // This avoids the error while achieving the same result. The GutterMarker is a "point" so from and to are the same.
                        markerRanges.push({ from: line.from, to: line.from, value: new BreakpointGutterMarker(!!condition) } as unknown as Range<GutterMarker>);
                    }
                }
                return RangeSet.of(markerRanges);
            }
        }
        return markers;
    }
});

// --- Debugger Line Highlight Logic ---
const debuggerLineEffect = StateEffect.define<number | null>();
const debuggerLineHighlight = StateField.define({
    create: () => Decoration.none,
    update(deco, tr) {
        deco = deco.map(tr.changes);
        for (let e of tr.effects) {
            if (e.is(debuggerLineEffect)) {
                deco = Decoration.none;
                if (e.value !== null && e.value <= tr.newDoc.lines) {
                    const line = tr.newDoc.line(e.value);
                    deco = deco.update({ add: [Decoration.line({ class: "cm-debugger-line" }).range(line.from)] });
                }
            }
        }
        return deco;
    },
    provide: f => EditorView.decorations.from(f),
});


const Editor: React.FC<EditorProps> = ({ content, onContentChange, activeFile, lintErrors, breakpoints, onSetBreakpoint, debuggerLine }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const linterCompartment = useRef(new Compartment());

  const createLintSource = useCallback((errors: LintingError[]): LintSource => {
    return () => {
        const doc = viewRef.current?.state.doc;
        if (!doc) return [];
        return errors.reduce<Diagnostic[]>((acc, err) => {
            if (err.line <= doc.lines) {
                const line = doc.line(err.line);
                if (line.from !== line.to) acc.push({ from: line.from, to: line.to, severity: err.severity, message: err.message });
            }
            return acc;
        }, []);
    };
  }, []);

  useEffect(() => {
    if (!editorRef.current) return;

    const breakpointGutter = gutter({
        class: "cm-breakpoint-gutter",
        markers: view => view.state.field(breakpointMarkers),
        domEventHandlers: {
            mousedown: (view, line, event) => {
                const lineNum = view.state.doc.lineAt(line.from).number;
                const existingCondition = breakpoints.get(lineNum);
                if (existingCondition !== undefined) {
                    const newCondition = window.prompt("Edit breakpoint condition (leave blank for unconditional, click Cancel to remove):", existingCondition);
                    if (newCondition === null) onSetBreakpoint(lineNum, null);
                    else onSetBreakpoint(lineNum, newCondition);
                } else {
                    const condition = window.prompt("Enter breakpoint condition (optional):");
                    if (condition !== null) onSetBreakpoint(lineNum, condition);
                }
                return true;
            }
        }
    });

    const startState = EditorState.create({
      doc: content,
      extensions: [
        lineNumbers(),
        breakpointGutter,
        breakpointMarkers,
        debuggerLineHighlight,
        keymap.of(defaultKeymap),
        javascript({ jsx: true, typescript: true }),
        retroTheme,
        EditorView.updateListener.of(update => {
          if (update.docChanged) onContentChange(update.state.doc.toString());
        }),
        linterCompartment.current.of(linter(createLintSource(lintErrors))),
        lintGutter(),
      ],
    });

    const view = new EditorView({ state: startState, parent: editorRef.current });
    viewRef.current = view;

    return () => { view.destroy(); viewRef.current = null; };
  }, []);

  useEffect(() => {
    if (viewRef.current && content !== viewRef.current.state.doc.toString()) {
      viewRef.current.dispatch({ changes: { from: 0, to: viewRef.current.state.doc.length, insert: content } });
    }
  }, [content, activeFile]);

  useEffect(() => {
    if (viewRef.current) {
        viewRef.current.dispatch({ effects: linterCompartment.current.reconfigure(linter(createLintSource(lintErrors), { delay: 0 })) });
    }
  }, [lintErrors, createLintSource]);

  useEffect(() => {
    if (viewRef.current) {
        viewRef.current.dispatch({ effects: [breakpointEffect.of(breakpoints)] });
    }
  }, [breakpoints]);

  useEffect(() => {
    if (viewRef.current) {
        viewRef.current.dispatch({ effects: [debuggerLineEffect.of(debuggerLine)] });
    }
  }, [debuggerLine]);

  return (
    <div className="bg-black/50 border border-green-800 p-2 flex flex-col h-full">
      <h2 className="text-sm mb-2 border-b-2 border-green-800 flex-shrink-0"> EDITOR: {activeFile || 'No file selected'} </h2>
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