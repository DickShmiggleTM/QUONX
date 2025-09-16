import React, { useState } from 'react';

/**
 * @interface Message
 * @description Represents a single message in the AI chat.
 * @property {string} id - The unique ID of the message.
 * @property {'user' | 'agent'} type - The type of the message sender.
 * @property {string} content - The content of the message.
 * @property {Date} timestamp - The timestamp of the message.
 */
interface Message {
  id: string;
  type: 'user' | 'agent';
  content: string;
  timestamp: Date;
}

/**
 * @interface AIAgentPanelProps
 * @description Props for the AIAgentPanel component.
 * @property {(query: string) => Promise<string>} onQuery - Function to handle AI queries.
 * @property {string | null} currentFile - The currently active file.
 */
interface AIAgentPanelProps {
  onQuery: (query: string) => Promise<string>;
  currentFile: string | null;
}

/**
 * @function AIAgentPanel
 * @description A component that provides an interface for interacting with an AI agent.
 * @param {AIAgentPanelProps} props - The props for the component.
 * @returns {JSX.Element} The rendered AIAgentPanel component.
 */
export const AIAgentPanel: React.FC<AIAgentPanelProps> = ({ onQuery, currentFile }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  /**
   * @function handleSendMessage
   * @description Sends a message to the AI agent and displays the response.
   * @returns {Promise<void>}
   */
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await onQuery(inputValue);
      const agentMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'agent',
        content: response,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, agentMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'agent',
        content: `Error: ${error}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * @function handleKeyPress
   * @description Handles key press events in the input field.
   * @param {React.KeyboardEvent} e - The keyboard event.
   * @returns {void}
   */
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  /**
   * @function formatTimestamp
   * @description Formats a timestamp for display.
   * @param {Date} timestamp - The timestamp to format.
   * @returns {string} The formatted timestamp.
   */
  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="ai-panel">
      <div className="ai-header">
        <span>AI AGENT</span>
        {currentFile && (
          <span className="context-file">Context: {currentFile.split('/').pop()}</span>
        )}
      </div>
      
      <div className="ai-messages">
        {messages.length === 0 && (
          <div className="welcome-message">
            <h3>AI Assistant Ready</h3>
            <p>Ask me to:</p>
            <ul>
              <li>Explain code</li>
              <li>Generate functions</li>
              <li>Debug issues</li>
              <li>Refactor code</li>
              <li>Answer questions</li>
            </ul>
          </div>
        )}
        
        {messages.map((message) => (
          <div key={message.id} className={`ai-message ${message.type}`}>
            <div className="message-header">
              <span className="message-type">
                {message.type === 'user' ? 'USER' : 'AGENT'}
              </span>
              <span className="message-time">
                {formatTimestamp(message.timestamp)}
              </span>
            </div>
            <div className="message-content">
              {message.content}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="ai-message agent">
            <div className="message-header">
              <span className="message-type">AGENT</span>
              <span className="message-time">Thinking...</span>
            </div>
            <div className="message-content">
              <div className="thinking-indicator">
                <span>●</span>
                <span>●</span>
                <span>●</span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="ai-input">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask the AI agent..."
          disabled={isLoading}
        />
        <button 
          onClick={handleSendMessage}
          disabled={isLoading || !inputValue.trim()}
        >
          SEND
        </button>
      </div>
    </div>
  );
};