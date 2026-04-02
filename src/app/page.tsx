"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  Terminal, Send, Square, Server, Cpu, Settings2, Clock, Zap, Shield, 
  FileText, ChevronRight, Copy, Check, Trash2, Maximize, Activity, Command as CmdIcon, 
  Code2, LayoutPanelLeft, Plus, Edit2, RefreshCw, Paperclip, X, Download,
  Search, PanelLeftOpen, AlertCircle, Lightbulb, ChevronDown, BrainCircuit, Printer,
  Mic, User, Sparkles
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { motion, AnimatePresence } from "framer-motion";

// --- TYPES & CONSTANTS ---
interface Message { id: string; role: "system" | "user" | "assistant"; content: string; timestamp: number; tokens: number; images?: string[]; }
interface Thread { id: string; title: string; updatedAt: number; messages: Message[]; agentId: string; }
interface Settings { model: string; temperature: number; maxTokens: number; thinkingEffort: "low" | "medium" | "high"; }

const AGENTS = [
  { id: "core", name: "OneChat Core", role: "Elite Assistant", prompt: "You are OneChat, an elite AI assistant. Be concise, highly accurate, and professional.", icon: CmdIcon, color: "text-zinc-100" },
  { id: "nexus", name: "Nexus Dev", role: "Senior Staff Engineer", prompt: "You are a Senior Staff Software Engineer. Focus purely on robust, production-ready code. Explain architectures clearly. Do not use conversational filler.", icon: Code2, color: "text-blue-400" },
  { id: "muse", name: "Creative Muse", role: "Master Copywriter", prompt: "You are a master copywriter and creative thinker. Use engaging, evocative, and persuasive language. Think outside the box.", icon: Sparkles, color: "text-purple-400" }
];

const genId = () => Math.random().toString(36).substring(2, 15);
const estimateTokens = (text: string) => Math.ceil(text.length / 4);
const timeFormat = (ts: number) => new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(ts);
const dateFormat = (ts: number) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(ts);
const TEMPLATES = [
  { label: "Explain Simply", prompt: "Explain this complex topic in simple terms, as if I were a beginner: " },
  { label: "Refactor Code", prompt: "Review and refactor the following code for better performance: \n```\n\n```" }
];

export default function Home() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<{name: string, content: string, type: 'text' | 'image'}[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  
  // Voice Mode State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  
  const [settings, setSettings] = useState<Settings>({
    model: "gpt-oss:20b", temperature: 0.7, maxTokens: 32768, thinkingEffort: "medium"
  });
  const [stats, setStats] = useState({ latency: 0, tps: 0 });

  const canvasRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortCtrl = useRef<AbortController | null>(null);

  // --- INIT & PERSISTENCE ---
  useEffect(() => {
    try {
      const saved = localStorage.getItem("onechat_data");
      const savedSettings = localStorage.getItem("onechat_settings");
      if (savedSettings) setSettings(JSON.parse(savedSettings));
      if (saved) {
        const parsed = JSON.parse(saved); setThreads(parsed);
        if (parsed.length > 0) setActiveId(parsed[0].id);
      } else createThread();
    } catch (e) { createThread(); }
  }, []);

  useEffect(() => {
    try {
      if (threads.length > 0) localStorage.setItem("onechat_data", JSON.stringify(threads));
      localStorage.setItem("onechat_settings", JSON.stringify(settings));
    } catch (e) {}
  }, [threads, settings]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'k') { e.preventDefault(); setIsSearchOpen(true); }
      if (e.ctrlKey && e.key === '/') { e.preventDefault(); inputRef.current?.focus(); }
      if (e.ctrlKey && e.key === 'Backspace') { e.preventDefault(); setInput(""); setFiles([]); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (canvasRef.current && (isLoading || input.length === 0)) canvasRef.current.scrollTo({ top: canvasRef.current.scrollHeight, behavior: "smooth" });
  }, [threads, activeId, isLoading]);

  const active = threads.find(t => t.id === activeId);
  const currentAgent = AGENTS.find(a => a.id === active?.agentId) || AGENTS[0];
  const updateActive = (updates: Partial<Thread>) => setThreads(prev => prev.map(t => t.id === activeId ? { ...t, ...updates, updatedAt: Date.now() } : t));

  const createThread = () => { const nt: Thread = { id: genId(), title: "New Workspace", updatedAt: Date.now(), messages: [], agentId: "core" }; setThreads(prev => [nt, ...prev]); setActiveId(nt.id); };
  const deleteThread = (id: string, e?: React.MouseEvent) => {
    if(e) e.stopPropagation();
    setThreads(prev => { const f = prev.filter(t => t.id !== id); if (activeId === id) setActiveId(f.length > 0 ? f[0].id : null); if (f.length === 0) setTimeout(createThread, 0); return f; });
  };

  // --- VOICE PROTOCOL ---
  const toggleVoice = () => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Voice recognition is not supported in this browser.");

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (e: any) => {
      const transcript = Array.from(e.results).map((res: any) => res[0].transcript).join('');
      setInput(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    
    recognition.start();
    recognitionRef.current = recognition;
  };

  // --- CORE EXECUTION ---
  const handleExecute = async (overridePrompt?: string, msgIdToReplace?: string) => {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); }
    
    let promptText = overridePrompt !== undefined ? overridePrompt : input;
    if (!active || (!promptText.trim() && files.length === 0) || isLoading) return;
    
    const textFiles = files.filter(f => f.type === 'text');
    const imageFiles = files.filter(f => f.type === 'image');

    if (textFiles.length > 0 && !overridePrompt) {
      const fileContext = textFiles.map(f => `\n--- FILE: ${f.name} ---\n${f.content}\n--- END FILE ---\n`).join("");
      promptText = `[ATTACHED CONTEXT]\n${fileContext}\n\n[USER DIRECTIVE]\n${promptText}`;
    }

    const userMsg: Message = { id: genId(), role: "user", content: promptText.trim(), timestamp: Date.now(), tokens: estimateTokens(promptText.trim()), images: imageFiles.length > 0 ? imageFiles.map(f => f.content) : undefined };
    let title = active.title;
    if (active.messages.length === 0 || title === "New Workspace") title = (promptText.trim() || "Image Analysis").split(" ").slice(0, 5).join(" ").replace(/[^a-zA-Z0-9 ]/g, '') + "...";

    let newMsgs = [...active.messages];
    if (msgIdToReplace) { const idx = newMsgs.findIndex(m => m.id === msgIdToReplace); if (idx !== -1) newMsgs = newMsgs.slice(0, idx); }
    newMsgs.push(userMsg);

    updateActive({ messages: newMsgs, title });
    if (!overridePrompt) { setInput(""); setFiles([]); }
    setIsLoading(true);

    abortCtrl.current = new AbortController();
    const start = performance.now();
    const aiId = genId();

    updateActive({ messages: [...newMsgs, { id: aiId, role: "assistant", content: "", timestamp: Date.now(), tokens: 0 }] });

    try {
      const payload = [{ role: "system", content: currentAgent.prompt }, ...newMsgs.map(m => ({ role: m.role, content: m.content, images: m.images ? m.images.map(img => img.split(',')[1]) : undefined }))];
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payload, model: settings.model, temperature: settings.temperature, maxTokens: settings.maxTokens, thinkingEffort: settings.thinkingEffort }),
        signal: abortCtrl.current?.signal,
      });
      if (!res.ok) throw new Error("Connection Refused.");
      const data = await res.json();
      const finalContent = data.content || data.message?.content || "No response generated.";
      const end = performance.now();
      const lat = Math.round(end - start);
      const tkns = estimateTokens(finalContent);
      setStats({ latency: lat, tps: Math.round((tkns / (lat / 1000)) * 10) / 10 });
      updateActive({ messages: [...newMsgs, { id: aiId, role: "assistant", content: finalContent, timestamp: Date.now(), tokens: estimateTokens(finalContent) }] });
    } catch (err: any) {
      if (err.name !== "AbortError") updateActive({ messages: [...newMsgs, { id: aiId, role: "assistant", content: "> **SYSTEM ERROR**: Connection severed. Check local inference engine.", timestamp: Date.now(), tokens: 0 }]});
    } finally {
      setIsLoading(false); abortCtrl.current = null; inputRef.current?.focus();
    }
  };

  const handleHalt = () => { if (abortCtrl.current) { abortCtrl.current.abort(); setIsLoading(false); } };
  const handleEdit = (msgId: string) => { const idx = active?.messages.findIndex(m => m.id === msgId) ?? -1; if (idx !== -1) { setInput(active!.messages[idx].content); updateActive({ messages: active!.messages.slice(0, idx) }); inputRef.current?.focus(); } };
  const handleRegenerate = (msgId: string) => { const idx = active?.messages.findIndex(m => m.id === msgId) ?? -1; if (idx > 0) handleExecute(active!.messages[idx - 1].content, active!.messages[idx - 1].id); };
  const deleteMessage = (msgId: string) => updateActive({ messages: active!.messages.filter(m => m.id !== msgId) });
  const copyText = (txt: string, id: string) => { navigator.clipboard.writeText(txt); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); };
  
  const processFiles = (fileList: File[]) => {
    const validTextExts = ['.txt', '.md', '.json', '.csv', '.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.env', '.yml'];
    fileList.forEach(file => {
      const isImage = file.type.startsWith('image/');
      const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (!isImage && !validTextExts.includes(fileExt)) { alert(`Unsupported format: ${file.name}. Only Code files, Text, and Images are allowed.`); return; }
      if (file.size > 5 * 1024 * 1024) { alert(`${file.name} is too large (Max 5MB).`); return; }
      const reader = new FileReader();
      reader.onload = (event) => { if (event.target?.result) setFiles(prev => [...prev, { name: file.name, content: event.target!.result as string, type: isImage ? 'image' : 'text' }]); };
      if (isImage) reader.readAsDataURL(file); else reader.readAsText(file);
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => { processFiles(Array.from(e.target.files || [])); if(fileInputRef.current) fileInputRef.current.value = ''; };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); processFiles(Array.from(e.dataTransfer.files)); };
  const exportPDF = () => { window.print(); };
  const exportMD = () => {
    if (!active) return;
    const dataStr = `# ${active.title}\n\n` + active.messages.map(m => `### ${m.role === 'user' ? 'User' : 'OneChat'}\n${m.content}\n`).join("\n---\n\n");
    const blob = new Blob([dataStr], { type: "text/plain" }); const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${active.title.replace(/\s+/g, '_')}.md`; a.click(); URL.revokeObjectURL(url);
  };

  const MessageBubble = ({ msg, isLast, isLoading }: { msg: Message, isLast: boolean, isLoading: boolean }) => {
    const hasThinkStart = msg.content.includes('<think>');
    const hasThinkEnd = msg.content.includes('</think>');
    const [isThoughtOpen, setIsThoughtOpen] = useState(!hasThinkEnd);
    useEffect(() => { if (!hasThinkEnd && isLoading) setIsThoughtOpen(true); else if (hasThinkEnd && !isLoading) setIsThoughtOpen(false); }, [hasThinkEnd, isLoading]);

    let thought = null; let finalContent = msg.content;
    if (hasThinkStart) {
      const parts = msg.content.split('<think>'); const afterStart = parts[1] || '';
      if (hasThinkEnd) {
        const innerParts = afterStart.split('</think>');
        thought = innerParts[0].trim(); finalContent = parts[0] + (innerParts[1] || '').trim();
      } else {
        thought = afterStart.trim(); finalContent = parts[0].trim();
      }
    }

    return (
      <div className="prose prose-invert prose-p:text-[15px] prose-p:leading-[1.7] prose-p:text-zinc-300 prose-headings:text-white prose-a:text-indigo-400 max-w-none break-words min-w-0 w-full">
        {thought && (
          <div className="mb-6 border border-white/10 rounded-xl bg-[#0a0a0a] overflow-hidden shadow-lg w-full print:hidden">
            <button onClick={() => setIsThoughtOpen(!isThoughtOpen)} className="flex items-center gap-3 px-5 py-3 w-full text-left text-zinc-400 hover:text-white hover:bg-white/5 transition-colors text-[13px] font-mono">
              {!hasThinkEnd && isLoading ? <Activity className="w-4 h-4 text-amber-500 animate-pulse" /> : <Lightbulb className="w-4 h-4 text-amber-500/70" />}
              {!hasThinkEnd && isLoading ? "Thinking..." : "Thought Process"}
              <span className="ml-2 text-zinc-600 text-[10px] uppercase">{estimateTokens(thought)} tokens</span>
              <ChevronRight className={`w-4 h-4 ml-auto transition-transform duration-300 ${isThoughtOpen ? 'rotate-90' : ''}`} />
            </button>
            <AnimatePresence>
              {isThoughtOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="p-5 border-t border-white/5 text-zinc-500 text-[13px] leading-relaxed whitespace-pre-wrap font-sans bg-[#050505]">{thought}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        {finalContent.trim() === "" && isLoading && isLast ? (
          <div className="flex items-center gap-3 opacity-60 ml-2">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" /><div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{animationDelay: '150ms'}} /><div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{animationDelay: '300ms'}} />
          </div>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
            code({ node, inline, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || ""); const str = String(children).replace(/\n$/, "");
              return !inline && match ? (
                <div className="my-6 border border-white/10 bg-[#050505] rounded-xl overflow-hidden shadow-lg group/code w-full">
                  <div className="flex justify-between items-center px-4 py-2 bg-[#111] border-b border-white/5 print:hidden">
                    <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-500">{match[1]}</span>
                    <button onClick={() => copyText(str, str.substring(0, 10))} className="text-[10px] uppercase font-medium tracking-wider text-zinc-500 hover:text-white transition-colors opacity-0 group-hover/code:opacity-100 flex items-center gap-1">
                      {copiedId === str.substring(0, 10) ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />} Copy
                    </button>
                  </div>
                  <SyntaxHighlighter style={vscDarkPlus as any} language={match[1]} PreTag="div" customStyle={{ margin: 0, padding: "1.25rem", background: "transparent", fontSize: "13px" }} {...props}>{str}</SyntaxHighlighter>
                </div>
              ) : <code className="bg-white/10 text-indigo-200 px-1.5 py-0.5 rounded text-[13px] font-mono" {...props}>{children}</code>;
            }
          }}>{finalContent}</ReactMarkdown>
        )}
      </div>
    );
  };

  const currentTokens = active?.messages.reduce((acc, m) => acc + (m.tokens || estimateTokens(m.content)), 0) || 0;
  const contextPercentage = Math.min((currentTokens / settings.maxTokens) * 100, 100);

  return (
    <div onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop} className="flex h-screen w-full bg-[#000000] text-zinc-300 font-sans overflow-hidden selection:bg-indigo-500/30 selection:text-white relative">
      <AnimatePresence>
        {isDragging && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[200] bg-indigo-500/10 backdrop-blur-sm border-2 border-indigo-500 border-dashed m-4 rounded-3xl flex items-center justify-center pointer-events-none">
            <div className="bg-black/80 px-8 py-6 rounded-2xl flex flex-col items-center shadow-2xl">
              <FileText className="w-12 h-12 text-indigo-400 mb-4 animate-bounce" />
              <h2 className="text-xl font-bold text-white tracking-wide">Drop Files to Attach Context</h2>
              <p className="text-zinc-400 text-sm mt-2">Supports Code Files, TXT, MD, JSON, CSV</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {isSidebarOpen && (
          <motion.aside initial={{ width: 0, opacity: 0 }} animate={{ width: 320, opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="h-full bg-[#050505] border-r border-white/5 flex flex-col shrink-0 z-30 shadow-2xl relative overflow-hidden print-hidden">
            <div className="h-16 px-6 flex items-center justify-between border-b border-white/5 bg-black w-[320px]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-zinc-100 flex items-center justify-center rounded-lg"><CmdIcon className="w-4 h-4 text-black" strokeWidth={2.5} /></div>
                <span className="text-[14px] font-bold tracking-[0.2em] text-white uppercase">OneChat</span>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="text-zinc-500 hover:text-white md:hidden"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 flex gap-2 border-b border-white/5 w-[320px]">
              <button onClick={createThread} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-[12px] font-medium transition-all text-white"><Plus className="w-4 h-4" /> New Chat</button>
              <button onClick={() => setIsSearchOpen(true)} className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-zinc-400 transition-all"><Search className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 custom-scrollbar w-[320px]">
              {threads.map(t => (
                <div key={t.id} onClick={() => setActiveId(t.id)} className={`w-full flex flex-col px-4 py-3 cursor-pointer rounded-xl transition-all group ${activeId === t.id ? "bg-white/10 shadow-lg" : "hover:bg-white/5"}`}>
                  <div className="flex justify-between items-start mb-1 gap-2">
                    <span className={`text-[13px] font-medium truncate ${activeId === t.id ? "text-white" : "text-zinc-300 group-hover:text-white"}`}>{t.title}</span>
                    <button onClick={(e) => deleteThread(t.id, e)} className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  <span className="text-[10px] text-zinc-600 font-mono">{dateFormat(t.updatedAt)} • {t.messages.length} msgs</span>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-white/5 bg-black w-[320px]">
              <button onClick={() => setIsSettingsOpen(true)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 rounded-xl transition-all">
                <Settings2 className="w-5 h-5 text-zinc-400" />
                <div className="flex flex-col items-start">
                  <span className="text-[13px] font-medium text-zinc-200">Configuration</span>
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">{settings.model.split(":")[0]}</span>
                </div>
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col relative min-w-0 bg-[#050505]" id="printable-chat">
        <header className="h-16 px-4 md:px-8 flex items-center justify-between border-b border-white/5 bg-black/80 backdrop-blur-md z-10 sticky top-0 shadow-sm print-hidden">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-all"><PanelLeftOpen className="w-4 h-4" /></button>}
            
            {/* AGENT MULTIVERSE SWITCHER */}
            <div className="relative group/agent">
              <button className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/5">
                <currentAgent.icon className={`w-4 h-4 ${currentAgent.color}`} />
                <div className="flex flex-col items-start">
                  <span className="text-[13px] font-medium text-zinc-100 leading-tight">{currentAgent.name}</span>
                  <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest leading-tight">{currentAgent.role}</span>
                </div>
                <ChevronDown className="w-3 h-3 text-zinc-500 ml-2" />
              </button>
              
              <div className="absolute top-full mt-2 left-0 w-64 bg-[#111] border border-white/10 rounded-xl shadow-2xl opacity-0 invisible group-hover/agent:opacity-100 group-hover/agent:visible transition-all flex flex-col p-1 z-50">
                {AGENTS.map((agent) => (
                  <button 
                    key={agent.id} 
                    onClick={() => updateActive({ agentId: agent.id })}
                    className={`flex items-center gap-3 px-3 py-2.5 text-left rounded-lg transition-colors ${active?.agentId === agent.id ? "bg-white/10" : "hover:bg-white/5"}`}
                  >
                    <div className="p-2 bg-black rounded-md border border-white/5"><agent.icon className={`w-4 h-4 ${agent.color}`} /></div>
                    <div className="flex flex-col">
                      <span className="text-[12px] font-medium text-white">{agent.name}</span>
                      <span className="text-[10px] text-zinc-500">{agent.role}</span>
                    </div>
                    {active?.agentId === agent.id && <Check className="w-4 h-4 text-emerald-500 ml-auto" />}
                  </button>
                ))}
              </div>
            </div>

          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-4 px-4 py-1.5 bg-white/5 rounded-full border border-white/5 text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-amber-500" /> {stats.latency}ms</span>
              <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-emerald-500" /> {stats.tps} t/s</span>
            </div>
            {active && active.messages.length > 0 && (
              <div className="flex gap-2">
                <button onClick={() => exportMD()} className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-all" title="Export Markdown"><Download className="w-4 h-4" /></button>
                <button onClick={exportPDF} className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-all" title="Print / Save PDF"><Printer className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        </header>

        <div ref={canvasRef} className="flex-1 overflow-y-auto custom-scrollbar px-4 md:px-12 py-8 scroll-smooth w-full">
          {!active || active.messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-60 print-hidden">
              <currentAgent.icon className={`w-16 h-16 ${currentAgent.color} mb-6`} strokeWidth={1} />
              <h2 className="text-[16px] font-mono tracking-[0.2em] text-zinc-300 uppercase">{currentAgent.name} Ready</h2>
              <p className="text-[12px] text-zinc-500 mt-2">{currentAgent.role} initialized.</p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto flex flex-col gap-8 pb-10 w-full">
              {active.messages.map((msg, i) => (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={msg.id} className={`relative flex w-full group/message ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "user" ? (
                    <div className="bg-[#18181b] border border-white/5 px-6 py-4 rounded-2xl rounded-tr-sm shadow-lg max-w-[85%] relative group/bubble print-user-bubble">
                      <div className="flex items-center gap-2 mb-2 print:hidden"><Terminal className="w-3 h-3 text-indigo-400" /><span className="text-[9px] font-mono uppercase tracking-widest text-zinc-500">Input Directive</span></div>
                      {msg.images && msg.images.length > 0 && (
                        <div className="flex gap-2 mb-3 overflow-x-auto custom-scrollbar pb-2">
                          {msg.images.map((img, idx) => (<img key={idx} src={img} alt="Attached Context" className="h-28 w-auto rounded-lg border border-white/10 object-cover shadow-sm" />))}
                        </div>
                      )}
                      <p className="text-[15px] text-zinc-200 font-sans leading-relaxed whitespace-pre-wrap break-words print:text-black">{msg.content}</p>
                      <div className="absolute -left-12 top-0 opacity-0 group-hover/bubble:opacity-100 flex flex-col gap-1 print:hidden">
                        <button onClick={() => handleEdit(msg.id)} className="p-1.5 bg-white/5 hover:bg-white/10 rounded text-zinc-400"><Edit2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-4 w-full">
                      <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-1 shadow-[0_0_15px_rgba(99,102,241,0.1)] print:hidden"><currentAgent.icon className={`w-4 h-4 ${currentAgent.color}`} /></div>
                      <div className="flex-1 min-w-0 bg-[#0a0a0a] border border-white/10 rounded-2xl rounded-tl-sm p-6 md:p-8 shadow-xl relative group/bubble w-full print-ai-bubble">
                        <div className="absolute top-4 right-4 opacity-0 group-hover/bubble:opacity-100 flex items-center gap-1.5 bg-[#111] p-1 rounded-lg border border-white/5 print:hidden">
                          <button onClick={() => copyText(msg.content, msg.id)} className="p-1.5 hover:bg-white/10 rounded text-zinc-400">{copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}</button>
                          <button onClick={() => handleRegenerate(msg.id)} className="p-1.5 hover:bg-white/10 rounded text-zinc-400"><RefreshCw className="w-3.5 h-3.5" /></button>
                          <button onClick={() => deleteMessage(msg.id)} className="p-1.5 hover:bg-red-500/20 rounded text-zinc-400"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                        <MessageBubble msg={msg} isLast={i === active.messages.length - 1} isLoading={isLoading} />
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <div className="w-full px-4 md:px-12 pb-8 pt-4 bg-gradient-to-t from-black via-black/90 to-transparent z-20 print-hidden">
          <div className="max-w-3xl mx-auto relative">
            {files.length > 0 && (
              <div className="flex gap-3 mb-4 px-2 overflow-x-auto custom-scrollbar pb-2">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 bg-[#18181b] border border-white/10 px-4 py-2.5 rounded-xl shadow-lg shrink-0">
                    {f.type === 'image' ? (
                      <div className="w-8 h-8 rounded-md overflow-hidden border border-white/10 shrink-0"><img src={f.content} alt={f.name} className="w-full h-full object-cover" /></div>
                    ) : (
                      <div className="p-2 bg-indigo-500/20 rounded-lg shrink-0"><FileText className="w-4 h-4 text-indigo-400" /></div>
                    )}
                    <div className="flex flex-col max-w-[120px]"><span className="text-[12px] text-zinc-200 font-medium truncate">{f.name}</span><span className="text-[9px] text-zinc-500 uppercase font-mono">{f.type === 'image' ? 'Image' : 'Context Added'}</span></div>
                    <button onClick={() => setFiles(fs => fs.filter((_, idx) => idx !== i))} className="text-zinc-500 hover:text-white ml-2 p-1 bg-white/5 rounded-md hover:bg-red-500/20 hover:text-red-400 transition-colors"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && files.length === 0 && input.length === 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-3 px-2">
                {TEMPLATES.map((t, i) => (
                  <button key={i} onClick={() => { setInput(t.prompt); inputRef.current?.focus(); }} className="px-3 py-1.5 bg-transparent hover:bg-white/5 border border-white/10 rounded-full text-[12px] text-zinc-400 hover:text-zinc-200 transition-colors shadow-sm">{t.label}</button>
                ))}
              </div>
            )}
            
            <div className="relative flex items-end bg-[#212121] border border-white/5 rounded-[32px] p-2 shadow-2xl focus-within:ring-1 focus-within:ring-white/10 transition-all">
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} multiple className="hidden" />
              
              <div className="flex items-center gap-2 shrink-0 pb-1 pl-1">
                <button onClick={() => fileInputRef.current?.click()} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors" title="Attach File">
                  <Plus className="w-4 h-4" />
                </button>
                
                <div className="relative group/effort hidden sm:block">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-full text-zinc-300 text-[13px] font-medium transition-colors">
                    <BrainCircuit className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="capitalize">{settings.thinkingEffort}</span>
                    <ChevronDown className="w-3 h-3 text-zinc-500" />
                  </button>
                  <div className="absolute bottom-full left-0 mb-2 w-32 bg-[#111] border border-white/10 rounded-xl shadow-2xl opacity-0 invisible group-hover/effort:opacity-100 group-hover/effort:visible transition-all flex flex-col p-1 overflow-hidden z-50">
                    {["low", "medium", "high"].map((level) => (
                      <button key={level} onClick={() => setSettings({...settings, thinkingEffort: level as any})} className={`px-3 py-2 text-left text-[12px] font-medium rounded-lg capitalize transition-colors ${settings.thinkingEffort === level ? "bg-indigo-500/20 text-indigo-300" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"}`}>
                        {level} Thinking
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <textarea 
                ref={inputRef} value={input} 
                onChange={(e) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`; }} 
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleExecute(); e.currentTarget.style.height = 'auto'; } }} 
                placeholder={`Message ${currentAgent.name}...`} 
                disabled={isLoading} rows={1} 
                className="flex-1 bg-transparent text-zinc-100 px-3 py-2 min-h-[40px] max-h-[200px] resize-none focus:outline-none custom-scrollbar text-[15px] leading-relaxed placeholder-zinc-500" 
              />
              
              <div className="shrink-0 pb-1 pr-1 flex gap-1">
                {/* VOICE MODE BUTTON */}
                

                {isLoading ? (
                   <button onClick={handleHalt} className="w-8 h-8 rounded-full bg-white text-black hover:bg-zinc-200 transition-colors flex items-center justify-center"><Square className="w-3.5 h-3.5 fill-current" /></button>
                ) : (
                   <button onClick={() => handleExecute()} disabled={!input.trim() && files.length === 0} className="w-8 h-8 rounded-full bg-white/10 text-white hover:bg-white disabled:bg-transparent disabled:text-zinc-600 disabled:hover:bg-transparent transition-colors flex items-center justify-center"><Send className="w-4 h-4 ml-0.5" /></button>
                )}
              </div>
            </div>
            
            <div className="text-center mt-2 flex justify-center items-center gap-2">
               <span className="text-[10px] text-zinc-600 font-medium hidden sm:inline">Ctrl + / to focus</span>
               <span className="text-[10px] text-zinc-600 font-medium hidden sm:inline">•</span>
               <span className="text-[10px] text-zinc-600 font-medium">{currentTokens} / {settings.maxTokens} ctx used</span>
            </div>
          </div>
        </div>
      </main>

      {/* --- SETTINGS MODAL --- */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSettingsOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-5 border-b border-white/10 flex justify-between items-center bg-black"><h3 className="text-[14px] font-bold text-white uppercase tracking-widest"><Settings2 className="w-4 h-4 inline mr-2" /> Configuration</h3><button onClick={() => setIsSettingsOpen(false)} className="text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button></div>
              <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                <div className="space-y-3"><label className="text-[11px] font-mono uppercase tracking-widest text-zinc-500">Core Model</label><select value={settings.model} onChange={(e) => setSettings({...settings, model: e.target.value})} className="w-full bg-[#111] border border-white/10 text-zinc-200 text-sm p-3 focus:outline-none focus:border-white/30 rounded-lg"><option value="qwen2.5:14b">Qwen 2.5 (14B)</option><option value="gpt-oss:20b">GPT-OSS (20B)</option></select></div>
                <div className="space-y-6">
                  <div><div className="flex justify-between mb-2"><label className="text-[11px] font-mono uppercase tracking-widest text-zinc-500">Temperature</label><span className="text-xs text-zinc-400">{settings.temperature}</span></div><input type="range" min="0" max="2" step="0.1" value={settings.temperature} onChange={(e) => setSettings({...settings, temperature: parseFloat(e.target.value)})} className="w-full accent-indigo-500" /></div>
                  <div><div className="flex justify-between mb-1"><label className="text-[11px] font-mono uppercase tracking-widest text-zinc-500">Context Length</label><span className="text-xs font-mono text-zinc-300">{settings.maxTokens >= 1000 ? `${settings.maxTokens/1000}k` : settings.maxTokens}</span></div><input type="range" min="4096" max="262144" step="4096" value={settings.maxTokens} onChange={(e) => setSettings({...settings, maxTokens: parseInt(e.target.value)})} className="w-full accent-indigo-500 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer" /><div className="flex justify-between text-[9px] font-mono text-zinc-600 mt-1"><span>4k</span><span>256k</span></div></div>
                </div>
                <div className="pt-6 border-t border-white/10 flex flex-col gap-3"><button onClick={() => { localStorage.removeItem("onechat_data"); setThreads([]); createThread(); setIsSettingsOpen(false); }} className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg text-sm font-medium transition-all flex justify-center items-center gap-2"><AlertCircle className="w-4 h-4" /> Purge All Data</button></div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- SEARCH PALETTE (Ctrl + K) --- */}
      <AnimatePresence>
        {isSearchOpen && (
          <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSearchOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: -20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -20 }} className="relative w-full max-w-2xl bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
              <div className="flex items-center px-4 py-4 border-b border-white/10"><Search className="w-5 h-5 text-zinc-500 mr-3" /><input autoFocus value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search workspaces..." className="flex-1 bg-transparent border-none text-zinc-100 text-[16px] focus:outline-none placeholder-zinc-600" /><button onClick={() => setIsSearchOpen(false)} className="text-[10px] bg-white/10 px-2 py-1 rounded text-zinc-400">ESC</button></div>
              <div className="max-h-[50vh] overflow-y-auto custom-scrollbar p-2">
                {threads.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase())).map(t => (
                  <div key={t.id} onClick={() => { setActiveId(t.id); setIsSearchOpen(false); }} className="px-4 py-3 hover:bg-white/5 rounded-xl cursor-pointer flex justify-between items-center group"><span className="text-zinc-300 font-medium">{t.title}</span><span className="text-zinc-600 font-mono text-[11px] group-hover:text-zinc-400 transition-colors">{t.messages.length} msgs</span></div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{__html: `
        /* HIDE NEXTJS DEV INDICATOR */
        #nextjs-build-indicator-router-portal, [data-nextjs-toast], nextjs-portal { display: none !important; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        @media print {
          body { background: white !important; color: black !important; }
          .print-hidden { display: none !important; }
          #printable-chat { position: absolute; left: 0; top: 0; width: 100%; display: block !important; padding: 20px; background: white !important; }
          .print-user-bubble { background: #f3f4f6 !important; border: 1px solid #e5e7eb !important; color: black !important; box-shadow: none !important; }
          .print-ai-bubble { background: white !important; border: none !important; color: black !important; box-shadow: none !important; }
          .prose * { color: black !important; }
        }
      `}} />
    </div>
  );
}