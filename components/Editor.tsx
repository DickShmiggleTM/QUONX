import React, { useEffect, useRef, useState } from 'react';
import { EditorState, Compartment, RangeSet, Range } from '@codemirror/state';
// FIX: Add Decoration to imports to create line highlights.
import { EditorView, keymap, GutterMarker, gutter, lineNumbers, highlightSpecialChars, drawSelection, highlightActiveLine, highlightActiveLineGutter, Decoration } from '@codemirror/view';
import { defaultKeymap, history, undo, redo } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { UndoIcon, RedoIcon, RefactorIcon, TestIcon, ExtractIcon } from './icons.tsx';

interface EditorProps {
  activeFile: string | null;
  content: string;
  onContentChange: (newContent: string) => void;
  breakpoints: Set<number>;
  onToggleBreakpoint: (lineNumber: number) => void;
  activeDebugLine: number | null;
  onCodeAction: (action: 'refactor' | 'test' | 'extract', selection: string) => void;
}

interface ContextMenuState {
    x: number;
    y: number;
    selection: string;
}

const breakpointMarker = new class extends GutterMarker {
  toDOM() { return document.createTextNode("🔴"); }
}();

const Editor: React.FC<EditorProps> = ({ activeFile, content, onContentChange, breakpoints, onToggleBreakpoint, activeDebugLine, onCodeAction }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  
  // Compartments for dynamic reconfiguration
  const editableCompartmentRef = useRef(new Compartment());
  const breakpointCompartmentRef = useRef(new Compartment());
  const activeLineCompartmentRef = useRef(new Compartment());

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // Effect for initialization and cleanup
  useEffect(() => {
    if (editorRef.current && !viewRef.current) {
      const startState = EditorState.create({
        doc: content,
        extensions: [
          lineNumbers(),
          highlightSpecialChars(),
          history(),
          drawSelection(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          keymap.of(defaultKeymap),
          javascript({ jsx: true, typescript: true }),
          oneDark,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onContentChange(update.state.doc.toString());
            }
          }),
          editableCompartmentRef.current.of(EditorView.editable.of(!!activeFile)),
          breakpointCompartmentRef.current.of([]),
          activeLineCompartmentRef.current.of([]),
          gutter({
            class: "cm-breakpoint-gutter",
            markers: () => RangeSet.empty,
            initialSpacer: () => breakpointMarker,
            domEventHandlers: {
              mousedown(view, line) {
                onToggleBreakpoint(view.state.doc.lineAt(line.from).number);
                return true;
              }
            }
          })
        ],
      });

      const view = new EditorView({
        state: startState,
        parent: editorRef.current,
      });
      viewRef.current = view;
    }

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Effect to handle external content changes
  useEffect(() => {
    const view = viewRef.current;
    if (view) {
      const currentDoc = view.state.doc.toString();
      if (content !== currentDoc) {
        view.dispatch({
          changes: { from: 0, to: currentDoc.length, insert: content || '' },
        });
      }
    }
  }, [content]);

  // Effect to enable/disable the editor
  useEffect(() => {
    const view = viewRef.current;
    if (view) {
       view.dispatch({
        effects: editableCompartmentRef.current.reconfigure(EditorView.editable.of(!!activeFile))
      });
    }
  }, [activeFile]);

  // Effect to update breakpoint markers
  useEffect(() => {
    const view = viewRef.current;
    if(view) {
        const markers = RangeSet.of(
            Array.from(breakpoints)
                .map(lineNumber => view.state.doc.line(lineNumber).from)
                .filter(pos => pos !== -1)
                .map(pos => breakpointMarker.range(pos))
        );
        view.dispatch({
            effects: breakpointCompartmentRef.current.reconfigure(
                gutter({
                    class: "cm-breakpoint-gutter",
                    markers: () => markers,
                })
            )
        });
    }
  }, [breakpoints]);
    
  // Effect to highlight the active debug line
  useEffect(() => {
    const view = viewRef.current;
    if (view) {
        let decoration;
        if (activeDebugLine !== null) {
            try {
                const { from } = view.state.doc.line(activeDebugLine);
                // FIX: Property 'from' does not exist on type 'typeof Range'. Replaced with correct CodeMirror 6 Decoration API.
                const lineHighlight = Decoration.line({
                    attributes: { style: "background-color: #00ff0030;" }
                });
                decoration = EditorView.decorations.of(Decoration.set([lineHighlight.range(from)]));
            } catch {
                decoration = EditorView.decorations.of(RangeSet.empty); // Line not found
            }
        } else {
            decoration = EditorView.decorations.of(RangeSet.empty);
        }
        view.dispatch({
            effects: activeLineCompartmentRef.current.reconfigure(decoration)
        });
    }
  }, [activeDebugLine]);

  // --- Handlers ---
  const handleUndo = () => viewRef.current && undo({ state: viewRef.current.state, dispatch: viewRef.current.dispatch });
  const handleRedo = () => viewRef.current && redo({ state: viewRef.current.state, dispatch: viewRef.current.dispatch });
  
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const view = viewRef.current;
    if (!view) return;

    const selection = view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to);
    if (selection) {
        setContextMenu({ x: e.clientX, y: e.clientY, selection });
    }
  };

  const handleCloseContextMenu = () => setContextMenu(null);

  useEffect(() => {
    if (contextMenu) {
        document.addEventListener('click', handleCloseContextMenu);
        return () => document.removeEventListener('click', handleCloseContextMenu);
    }
  }, [contextMenu]);


  return (
    <div ref={editorContainerRef} onContextMenu={handleContextMenu} className="bg-black/50 border-t-0 border-r border-b border-l border-green-800 p-0 flex flex-col h-full relative">
      <div className="absolute top-2 right-2 z-10 flex items-center space-x-2">
            <button onClick={handleUndo} disabled={!activeFile} className="p-1 border border-green-800 bg-gray-900/50 hover:bg-green-700 rounded-sm disabled:opacity-50" title="Undo"><UndoIcon className="w-4 h-4" /></button>
            <button onClick={handleRedo} disabled={!activeFile} className="p-1 border border-green-800 bg-gray-900/50 hover:bg-green-700 rounded-sm disabled:opacity-50" title="Redo"><RedoIcon className="w-4 h-4" /></button>
      </div>
      <div ref={editorRef} className="flex-grow overflow-hidden w-full h-full relative" />
      
      {contextMenu && (
        <div style={{ top: contextMenu.y - (editorContainerRef.current?.getBoundingClientRect().top || 0), left: contextMenu.x - (editorContainerRef.current?.getBoundingClientRect().left || 0) }}
             className="absolute bg-gray-800 border border-green-600 p-1 z-50 text-xs">
            <button onClick={() => onCodeAction('refactor', contextMenu.selection)} className="flex items-center w-full text-left px-2 py-1 hover:bg-green-700"><RefactorIcon className="w-4 h-4 mr-2"/> Refactor with AI</button>
            <button onClick={() => onCodeAction('test', contextMenu.selection)} className="flex items-center w-full text-left px-2 py-1 hover:bg-green-700"><TestIcon className="w-4 h-4 mr-2"/> Generate Test Stub</button>
            <button onClick={() => onCodeAction('extract', contextMenu.selection)} className="flex items-center w-full text-left px-2 py-1 hover:bg-green-700"><ExtractIcon className="w-4 h-4 mr-2"/> Extract Component</button>
        </div>
      )}
    </div>
  );
};

export default Editor;
