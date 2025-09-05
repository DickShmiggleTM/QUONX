import React, { useState, useRef, useEffect } from 'react';
// FIX: Added .tsx extension to the import path.
import { SendIcon, ThinkingIcon } from './icons.tsx';

interface Message {
    sender: 'user' | 'agent';
    text: string;
    thought?: string; // For agent's internal monologue
}

interface AIAgentPanelProps {
    messages: Message[];
    onSendMessage: (message: string) => void;
    isThinking: boolean;
}

const AIAgentPanel: React.FC<AIAgentPanelProps> = ({ messages, onSendMessage, isThinking }) => {
    const [prompt, setPrompt] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSend = () => {
        if (prompt.trim() && !isThinking) {
            onSendMessage(prompt);
            setPrompt('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="bg-black/50 border border-green-800 p-2 flex flex-col h-full">
            <h2 className="text-sm mb-2 border-b-2 border-green-800 flex-shrink-0">AI AGENT</h2>
            <div className="flex-grow overflow-y-auto mb-2 pr-2 text-xs">
                {messages.map((msg, index) => (
                    <div key={index} className={`mb-3 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                        <div className={`p-2 rounded-lg inline-block ${msg.sender === 'user' ? 'bg-green-900/50 text-green-300' : 'bg-gray-800/50 text-gray-300'}`}>
                           {msg.thought && (
                             <div className="border-b border-dashed border-yellow-600/50 pb-1 mb-1 text-yellow-400">
                               <p className="font-bold text-sm">Thought Process:</p>
                               <p className="whitespace-pre-wrap font-mono">{msg.thought}</p>
                             </div>
                           )}
                           <p className="whitespace-pre-wrap">{msg.text}</p>
                        </div>
                    </div>
                ))}
                {isThinking && (
                     <div className="text-left">
                        <div className="p-2 rounded-lg inline-block bg-gray-800/50 text-gray-300">
                           <div className="flex items-center">
                             <ThinkingIcon className="w-4 h-4 mr-2 animate-spin" />
                             <span>Thinking...</span>
                           </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="flex-shrink-0 flex items-center border-t-2 border-green-800 pt-2">
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your request to the AI agent..."
                    className="w-full bg-black border border-green-700 p-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-green-500"
                    rows={2}
                    disabled={isThinking}
                />
                <button
                    onClick={handleSend}
                    disabled={isThinking || !prompt.trim()}
                    className="ml-2 p-2 bg-green-700 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded"
                    aria-label="Send message"
                >
                   <SendIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

export default AIAgentPanel;
