import React, { useState, useRef, useEffect } from 'react';
import { CloseIcon } from './icons.tsx';

/**
 * @interface DraggableWindowProps
 * @description Props for the DraggableWindow component.
 * @property {string} title - The title of the window.
 * @property {React.ReactNode} children - The content of the window.
 * @property {boolean} isOpen - Whether the window is open.
 * @property {() => void} onClose - Function to close the window.
 * @property {{ x: number; y: number }} [initialPosition] - The initial position of the window.
 * @property {number} zIndex - The z-index of the window.
 * @property {() => void} onFocus - Function to bring the window to the front.
 */
interface DraggableWindowProps {
  title: string;
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  initialPosition?: { x: number; y: number };
  zIndex: number;
  onFocus: () => void;
}

/**
 * @function DraggableWindow
 * @description A component that creates a draggable window.
 * @param {DraggableWindowProps} props - The props for the component.
 * @returns {JSX.Element | null} The rendered DraggableWindow component, or null if it's not open.
 */
const DraggableWindow: React.FC<DraggableWindowProps> = ({ title, children, isOpen, onClose, initialPosition = { x: 150, y: 150 }, zIndex, onFocus }) => {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  /**
   * @function handleMouseDown
   * @description Handles the mouse down event on the window header to start dragging.
   * @param {React.MouseEvent<HTMLDivElement>} e - The mouse event.
   * @returns {void}
   */
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Prevent dragging when clicking on buttons inside the header
    if ((e.target as HTMLElement).closest('button')) return;
    
    onFocus(); // Bring window to the front
    setIsDragging(true);

    if (windowRef.current) {
      const rect = windowRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  useEffect(() => {
    /**
     * @function handleGlobalMouseMove
     * @description Handles the global mouse move event to drag the window.
     * @param {MouseEvent} e - The mouse event.
     * @returns {void}
     */
    const handleGlobalMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        setPosition({
            x: e.clientX - dragOffset.x,
            y: e.clientY - dragOffset.y,
        });
    };

    /**
     * @function handleGlobalMouseUp
     * @description Handles the global mouse up event to stop dragging.
     * @returns {void}
     */
    const handleGlobalMouseUp = () => {
        setIsDragging(false);
    };

    if (isDragging) {
        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
}, [isDragging, dragOffset]);


  if (!isOpen) return null;

  return (
    <div
      ref={windowRef}
      className="absolute bg-gray-900/90 border-2 border-green-700 flex flex-col shadow-lg backdrop-blur-sm"
      style={{ top: position.y, left: position.x, zIndex, width: '450px', minHeight: '300px', maxHeight: '70vh' }}
      onMouseDown={onFocus}
    >
      <header
        className="bg-green-800 text-black px-2 py-1 flex justify-between items-center cursor-move"
        onMouseDown={handleMouseDown}
      >
        <span className="font-bold select-none text-xs">{title}</span>
        <button
          onClick={onClose}
          className="p-0.5 hover:bg-red-500 rounded-sm"
          aria-label={`Close ${title} window`}
        >
          <CloseIcon className="w-4 h-4" />
        </button>
      </header>
      <main className="flex-grow overflow-hidden p-0">
        {children}
      </main>
    </div>
  );
};

export default DraggableWindow;
