import React, { useEffect, useRef } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';

interface EditorProps {
  filePath: string | null;
  content: string;
  onContentChange: (newContent: string) => void;
}

const Editor: React.FC<EditorProps> = ({ filePath, content, onContentChange }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const editableCompartmentRef = useRef(new Compartment());

  // Effect for initialization and cleanup
  useEffect(() => {
    if (editorRef.current && !viewRef.current) {
      const editableCompartment = editableCompartmentRef.current;
      const startState = EditorState.create({
        doc: content,
        extensions: [
          keymap.of(defaultKeymap),
          javascript({ jsx: true, typescript: true }),
          oneDark,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onContentChange(update.state.doc.toString());
            }
          }),
          editableCompartment.of(EditorView.editable.of(!!filePath)),
        ],
      });

      const view = new EditorView({
        state: startState,
        parent: editorRef.current,
      });
      viewRef.current = view;
    }

    // Cleanup
    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Effect to handle external content changes (e.g., switching files or AI edits)
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

  // Effect to enable/disable the editor based on file selection
  useEffect(() => {
    const view = viewRef.current;
    if (view) {
       view.dispatch({
        effects: editableCompartmentRef.current.reconfigure(EditorView.editable.of(!!filePath))
      });
    }
  }, [filePath]);


  return (
    <div className="bg-black/50 border border-green-800 p-2 flex flex-col h-full">
      <h2 className="text-sm mb-2 border-b-2 border-green-800 flex-shrink-0">
        EDITOR: {filePath || '[No file selected]'}
      </h2>
      <div ref={editorRef} className="flex-grow overflow-hidden w-full h-full relative" />
    </div>
  );
};

export default Editor;
