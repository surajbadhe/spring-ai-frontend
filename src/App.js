import React, { useState } from 'react';
import './App.css';

function App() {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handlePromptSubmit = async () => {
    setIsLoading(true);
    setResponse(''); // Clear previous response

    try {
      const res = await fetch(`http://localhost:8080/ollama/chat?message=${encodeURIComponent(prompt)}`);
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.text();
      setResponse(data);
      setPrompt(''); // This is the new line to clear the input box
    } catch (error) {
      setResponse(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Spring AI Chatbot</h1>
      </header>
      <main className="chat-interface">
        <div className="output-area">
          {isLoading ? (
            <p className="loading-message">Thinking...</p>
          ) : (
            <pre>{response}</pre>
          )}
        </div>
        <div className="input-area">
          <textarea
            className="prompt-input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Type your message here..."
            disabled={isLoading}
          />
          <button 
            className="submit-button" 
            onClick={handlePromptSubmit} 
            disabled={isLoading}
          >
            {isLoading ? '...' : 'Send'}
          </button>
        </div>
      </main>
    </div>
  );
}

export default App;