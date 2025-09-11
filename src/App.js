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
    const [imageFile, setImageFile] = useState(null);
    const [lastPrompt, setLastPrompt] = useState(''); // Track last submitted prompt for display
    const abortControllers = useRef({ ollama: null, gemini: null });
    // Ref for file input to reset its value
    const fileInputRef = useRef();

    const handleImageChange = (e) => {
        setImageFile(e.target.files[0]);
    };


const handlePromptSubmit = async () => {
    setIsLoading(true);
    setOllamaResponse('');
    setGeminiResponse('');
    setIsStopped(false);

    const promptMessage = prompt;
    setLastPrompt(promptMessage); // Save for display
    setPrompt('');

    // If image is selected, send to image endpoint and skip normal chat
    if (imageFile) {
        const formData = new FormData();
        formData.append('message', promptMessage);
        formData.append('image', imageFile);
        try {
            const res = await fetch('http://localhost:8080/gemini/chat/image', {
                method: 'POST',
                body: formData,
            });
            setGeminiResponse(await res.text());
        } catch (error) {
            setGeminiResponse(`Error: ${error.message}`);
        } finally {
            setIsLoading(false);
            setImageFile(null); // Clear image after response
            if (fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
        }
        return;
    }

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
                {/* Show only the prompt input above output */}
                <div style={{ width: '100%', maxWidth: 900, margin: '0 auto 18px auto', padding: '12px 24px', background: '#23272f', borderRadius: 10, color: '#fff', fontSize: 18, boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
                    <b>Input:</b> <span style={{ color: '#64ffda' }}>{prompt || lastPrompt}</span>
                </div>
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
    <div className="input-area" style={{ width: '100%', maxWidth: 900, margin: '30px auto', padding: 24, background: '#222831', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap', marginBottom: 8 }}>
                <span className="info-icon" style={{ cursor: 'pointer', position: 'relative' }}>
                    <span style={{ fontSize: '1.2em', color: '#64ffda' }}>ⓘ</span>
                    <span className="info-tooltip">
                        <b>Stream:</b> See the response as it is generated, useful for long answers or real-time feedback.<br/>
                        <b>Normal:</b> Get the full response at once, usually better formatted.
                    </span>
                </span>
                <label style={{ fontWeight: 500, color: '#fff', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                        type="radio"
                        value="stream"
                        checked={chatMode === 'stream'}
                        onChange={() => setChatMode('stream')}
                        disabled={isLoading}
                    />
                    Stream
                </label>
                <label style={{ fontWeight: 500, color: '#fff', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                        type="radio"
                        value="normal"
                        checked={chatMode === 'normal'}
                        onChange={() => setChatMode('normal')}
                        disabled={isLoading}
                    />
                    Normal
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', gap: 8 }}>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        disabled={isLoading}
                        style={{ color: '#fff', background: '#23272f', border: 'none', fontSize: 15 }}
                        ref={fileInputRef}
                    />
                    {imageFile && <span style={{ color: '#64ffda', fontSize: 13 }}>{imageFile.name}</span>}
                </div>
               
                {isLoading && chatMode === 'stream' && (
                    <button 
                        className="stop-button"
                        onClick={handleStop}
                        style={{ padding: '8px 18px', borderRadius: 8, background: '#ff1744', color: '#fff', border: 'none', fontWeight: 500, fontSize: 15, cursor: 'pointer' }}
                    >
                        Stop
                    </button>
                )}
            </div>
            <div style={{ display: 'flex', gap: 16, width: '100%' }}>
                <textarea
                    className="prompt-input"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ask me something?"
                    disabled={isLoading}
                    style={{ flex: 1, minHeight: 60, fontSize: 16, borderRadius: 8, border: '1px solid #393e46', padding: 10, background: '#23272f', color: '#fff', resize: 'vertical' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center', alignItems: 'flex-end' }}>
                    <button 
                        className="clear-button"
                        onClick={handleClear}
                        disabled={isLoading}
                        style={{ padding: '8px 18px', borderRadius: 8, background: '#393e46', color: '#fff', border: 'none', fontWeight: 500, fontSize: 15, cursor: 'pointer', marginBottom: 8 }}
                    >
                        Clear
                    </button>
                    <button 
                        className="submit-button" 
                        onClick={handlePromptSubmit} 
                        disabled={isLoading || !prompt}
                        style={{ padding: '8px 18px', borderRadius: 8, background: '#64ffda', color: '#23272f', border: 'none', fontWeight: 500, fontSize: 15, cursor: isLoading || !prompt ? 'not-allowed' : 'pointer' }}
                    >
                        {isLoading ? '...' : 'Send'}
                    </button>
                </div>
            </div>
        </div>
        </div>

      </main>
    </div>
  );
}

export default App;