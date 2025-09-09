import React, { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './App.css';

// Reusable Markdown Output Component
function MarkdownOutput({ response }) {
    return (
        <ReactMarkdown
            components={{
                code({node, inline, className, children, ...props}) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                        <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div" {...props}>
                            {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                    ) : (
                        <code className={className} {...props}>{children}</code>
                    );
                }
            }}
        >
            {response}
        </ReactMarkdown>
    );
}

function App() {
    // Robust Markdown cleaner for extra spaces inside bold/underline markers
    function cleanMarkdown(text) {
        // Remove spaces after opening and before closing ** and __ markers
        // Handles cases like ** Bold Text ** and __ Underline __
        return text
            .replace(/\*\*\s*([^*]+?)\s*\*\*/g, (m, p1) => `**${p1}**`)
            .replace(/__\s*([^_]+?)\s*__/g, (m, p1) => `__${p1}__`);
    }
    const [prompt, setPrompt] = useState('');
    const [ollamaResponse, setOllamaResponse] = useState('');
    const [geminiResponse, setGeminiResponse] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [chatMode, setChatMode] = useState('stream'); // 'stream' or 'normal'
    const [isStopped, setIsStopped] = useState(false);
    const abortControllers = useRef({ ollama: null, gemini: null });


const handlePromptSubmit = async () => {
    setIsLoading(true);
    setOllamaResponse('');
    setGeminiResponse('');
    setIsStopped(false);

    const promptMessage = prompt;
    setPrompt('');

    try {
        if (chatMode === 'stream') {
            // AbortController for each fetch
            abortControllers.current.ollama = new window.AbortController();
            abortControllers.current.gemini = new window.AbortController();

            const ollamaFetch = fetch(
                `http://localhost:8080/ollama/stream/chat?message=${encodeURIComponent(promptMessage)}`,
                { signal: abortControllers.current.ollama.signal }
            );
            const geminiFetch = fetch(
                `http://localhost:8080/gemini/stream/chat?message=${encodeURIComponent(promptMessage)}`,
                { signal: abortControllers.current.gemini.signal }
            );

            async function readStream(reader, setResponse) {
                const decoder = new TextDecoder();
                let buffer = '';
                while (true) {
                    if (isStopped) break;
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    const parts = buffer.split("\n\n");
                    buffer = parts.pop() || '';
                    for (let part of parts) {
                        part.split('\n').forEach(line => {
                            line = line.trim();
                            if (line.startsWith('data:')) {
                                let clean = line.replace(/^data:\s*/, '');
                                if (clean && clean !== '[DONE]') {
                                    clean = cleanMarkdown(clean);
                                    setResponse(prev => prev + clean + '\n');
                                }
                            }
                        });
                    }
                }
            }

            ollamaFetch.then(async res => {
                if (!res.ok) throw new Error('Ollama fetch failed');
                await readStream(res.body.getReader(), setOllamaResponse);
            }).catch(error => {
                if (error.name === 'AbortError') {
                    setOllamaResponse('Stopped.');
                } else {
                    setOllamaResponse(`Error: ${error.message}`);
                }
            });

            geminiFetch.then(async res => {
                if (!res.ok) throw new Error('Gemini fetch failed');
                await readStream(res.body.getReader(), setGeminiResponse);
            }).catch(error => {
                if (error.name === 'AbortError') {
                    setGeminiResponse('Stopped.');
                } else {
                    setGeminiResponse(`Error: ${error.message}`);
                }
            });
        } else {
            // Normal fetch logic
            const ollamaRes = await fetch(`http://localhost:8080/ollama/chat?message=${encodeURIComponent(promptMessage)}`);
            const geminiRes = await fetch(`http://localhost:8080/gemini/chat?message=${encodeURIComponent(promptMessage)}`);
            setOllamaResponse(await ollamaRes.text());
            setGeminiResponse(await geminiRes.text());
        }
    } catch (error) {
        setOllamaResponse(`Error: ${error.message}`);
        setGeminiResponse(`Error: ${error.message}`);
    } finally {
        setIsLoading(false);
    }
};

    // ... (rest of the component)
    // In App.js, inside the App function:
  const handleClear = () => {
      setPrompt('');
      setOllamaResponse('');
      setGeminiResponse('');
      setIsLoading(false);
      setIsStopped(false);
      // Abort any ongoing fetches
      if (abortControllers.current.ollama) abortControllers.current.ollama.abort();
      if (abortControllers.current.gemini) abortControllers.current.gemini.abort();
  };

  const handleStop = () => {
      setIsStopped(true);
      setIsLoading(false);
      // Abort any ongoing fetches
      if (abortControllers.current.ollama) abortControllers.current.ollama.abort();
      if (abortControllers.current.gemini) abortControllers.current.gemini.abort();
  };
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Spring AI: Chat with Ollama & Gemini</h1>
      </header>
      <main className="chat-interface">
        <div className="llm-output-container">
          <div className="llm-output-box">
              <h2>Ollama</h2>
              <div className="output-area">
                  {isLoading && !ollamaResponse && <p className="loading-message">Thinking...</p>}
                  {!isLoading && ollamaResponse && <MarkdownOutput response={ollamaResponse} />}
              </div>
          </div>
          <div className="llm-output-box">
              <h2>Gemini</h2>
              <div className="output-area">
                  {isLoading && !geminiResponse && <p className="loading-message">Thinking...</p>}
                  {!isLoading && geminiResponse && <MarkdownOutput response={geminiResponse} />}
              </div>
          </div>
        </div>
        <div className="input-area">
            <div className="mode-select" style={{ marginBottom: '10px', display: 'flex', alignItems: 'center' }}>
                <span className="info-icon" style={{ marginLeft: '10px', cursor: 'pointer', position: 'relative' }}>
                    <span style={{ fontSize: '1.2em', color: '#64ffda' }}>ⓘ</span>
                    <span className="info-tooltip">
                        <b>Stream:</b> See the response as it is generated, useful for long answers or real-time feedback.<br/>
                        <b>Normal:</b> Get the full response at once, usually better formatted.
                    </span>
                </span>
                <label>
                    <input
                        type="radio"
                        value="stream"
                        checked={chatMode === 'stream'}
                        onChange={() => setChatMode('stream')}
                        disabled={isLoading}
                    />
                    Stream
                </label>
                <label style={{ marginLeft: '15px' }}>
                    <input
                        type="radio"
                        value="normal"
                        checked={chatMode === 'normal'}
                        onChange={() => setChatMode('normal')}
                        disabled={isLoading}
                    />
                    Normal
                </label>
                
            </div>
            <textarea
                className="prompt-input"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask me something?"
                disabled={isLoading}
            />
            <button 
                className="clear-button"
                onClick={handleClear}
                disabled={isLoading}
            >
                Clear
            </button>
            <button 
                className="submit-button" 
                onClick={handlePromptSubmit} 
                disabled={isLoading || !prompt}
            >
                {isLoading ? '...' : 'Send'}
            </button>
            {isLoading && chatMode === 'stream' && (
                <button 
                    className="stop-button"
                    onClick={handleStop}
                >
                    Stop
                </button>
            )}
        </div>

      </main>
    </div>
  );
}

export default App;