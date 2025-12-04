
import React, { useState, useEffect, useRef } from 'react';
import { ViewState, Message, UserState, ChatSession } from './types';
import { BG_IMAGE_URL, APP_ICON_URL, ASSISTANT_AVATAR_URL, MAX_FREE_MESSAGES, DEVELOPER_NAME } from './constants';
import { sendMessageToGemini } from './geminiService';
import { SendIcon, ImageIcon, MoonIcon, SunIcon, TrashIcon, CopyIcon, SettingsIcon, MenuIcon, PlusIcon, ChatBubbleIcon } from './Icons';

const App: React.FC = () => {
  // State
  const [view, setView] = useState<ViewState>(ViewState.LANDING);
  const [user, setUser] = useState<UserState>({
    isLoggedIn: false,
    messageCount: 0,
    theme: 'dark',
  });
  
  const [currentSessionId, setCurrentSessionId] = useState<string>('default');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', phone: '' });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize
  useEffect(() => {
    const savedUser = localStorage.getItem('ai_amar_user');
    const savedSessions = localStorage.getItem('ai_amar_sessions');
    
    if (savedUser) setUser(JSON.parse(savedUser));
    
    if (savedSessions) {
        const parsedSessions = JSON.parse(savedSessions);
        setSessions(parsedSessions);
        if (parsedSessions.length > 0) {
             setMessages(parsedSessions[0].messages);
             setCurrentSessionId(parsedSessions[0].id);
        }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('ai_amar_user', JSON.stringify(user));
    if (user.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [user]);

  // Save Sessions
  useEffect(() => {
    if (messages.length > 0) {
        const updatedSessions = [...sessions];
        const existingSessionIndex = updatedSessions.findIndex(s => s.id === currentSessionId);
        
        const previewText = messages[messages.length - 1].text.substring(0, 30) + '...';
        
        if (existingSessionIndex >= 0) {
            updatedSessions[existingSessionIndex] = {
                ...updatedSessions[existingSessionIndex],
                messages: messages,
                preview: previewText
            };
        } else {
            updatedSessions.unshift({
                id: currentSessionId,
                title: 'محادثة جديدة',
                preview: previewText,
                date: new Date().toLocaleDateString('ar-EG'),
                messages: messages
            });
        }
        setSessions(updatedSessions);
        localStorage.setItem('ai_amar_sessions', JSON.stringify(updatedSessions));
    }
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const toggleTheme = () => {
    setUser(prev => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }));
  };

  const startNewChat = () => {
    const newId = Date.now().toString();
    setCurrentSessionId(newId);
    setMessages([]);
    setView(ViewState.CHAT);
    setIsSidebarOpen(false);
  };

  const loadSession = (session: ChatSession) => {
      setCurrentSessionId(session.id);
      setMessages(session.messages);
      setIsSidebarOpen(false);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const updated = sessions.filter(s => s.id !== id);
      setSessions(updated);
      localStorage.setItem('ai_amar_sessions', JSON.stringify(updated));
      if (currentSessionId === id) {
          setMessages([]);
          setCurrentSessionId(Date.now().toString());
      }
  };

  const cycleImageSize = () => {
    if (imageSize === '1K') setImageSize('2K');
    else if (imageSize === '2K') setImageSize('4K');
    else setImageSize('1K');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginForm.email || loginForm.phone) {
      setUser(prev => ({ ...prev, isLoggedIn: true, email: loginForm.email, phone: loginForm.phone }));
      setShowLoginModal(false);
    }
  };

  const handleSendMessage = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return;

    if (!user.isLoggedIn && user.messageCount >= MAX_FREE_MESSAGES) {
      setShowLoginModal(true);
      return;
    }

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      image: selectedImage || undefined,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, newMessage]);
    setInput('');
    setSelectedImage(null);
    setIsLoading(true);

    if (!user.isLoggedIn) {
      setUser(prev => ({ ...prev, messageCount: prev.messageCount + 1 }));
    }

    try {
      const historyContext = messages.slice(-10).map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
      }));

      const result = await sendMessageToGemini(newMessage.text || "تحليل", newMessage.image, historyContext, imageSize);
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: result.text,
        image: result.generatedImage,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, botMessage]);

    } catch (error) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: "عذراً، حدث خطأ تقني أو مشكلة في الاتصال. 😔",
        timestamp: Date.now(),
        isError: true
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const isDark = user.theme === 'dark';

  // Dynamic Theme Colors
  const bgMain = isDark ? 'bg-dark-950' : 'bg-light-50';
  const textMain = isDark ? 'text-white' : 'text-slate-800';
  const sidebarBg = isDark ? 'bg-dark-900 border-white/5' : 'bg-white border-slate-200';
  
  // Chat Bubble Colors
  const userBubble = isDark 
    ? 'bg-gradient-to-br from-primary-700 to-primary-600 text-white shadow-primary-500/10' 
    : 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-primary-500/20';
    
  const modelBubble = isDark 
    ? 'bg-dark-800 border border-white/5 text-gray-200' 
    : 'bg-white border border-slate-100 text-slate-700 shadow-sm';

  return (
    <div className={`flex h-screen overflow-hidden font-sans transition-colors duration-500 ${bgMain} ${textMain}`}>
      
      {/* --- Sidebar (History) --- */}
      {view === ViewState.CHAT && (
          <aside className={`
            fixed inset-y-0 right-0 z-40 w-72 transform transition-transform duration-300 ease-in-out
            ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}
            md:relative md:translate-x-0
            ${sidebarBg} border-l flex flex-col
          `}>
             <div className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md">
                      <img src={APP_ICON_URL} alt="Logo" className="w-full h-full object-cover" />
                   </div>
                   <div>
                       <span className="font-display font-bold text-xl tracking-tight block leading-none">AI AMAR</span>
                       <span className={`text-[10px] uppercase font-bold tracking-widest ${isDark ? 'text-accent-dark' : 'text-accent-light'}`}>Assistant</span>
                   </div>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-gray-500 hover:text-red-500 transition">✕</button>
             </div>

             <div className="px-4 mb-2">
                <button 
                  onClick={startNewChat}
                  className={`w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl transition-all font-bold shadow-lg 
                  ${isDark ? 'bg-primary-700 hover:bg-primary-600 text-white shadow-primary-900/20' : 'bg-primary-50 hover:bg-primary-600 text-white shadow-primary-200'}`}
                >
                  <PlusIcon /> محادثة جديدة
                </button>
             </div>

             <div className="flex-1 overflow-y-auto px-3 space-y-1 py-2">
                {sessions.length === 0 && (
                    <div className="text-center mt-10 opacity-50">
                        <p className="text-4xl mb-2">💬</p>
                        <p className="text-sm font-medium">ابدأ أول محادثة</p>
                    </div>
                )}
                {sessions.map(session => (
                    <div 
                      key={session.id}
                      onClick={() => loadSession(session)}
                      className={`group flex items-center gap-3 p-3.5 rounded-xl cursor-pointer transition-all border border-transparent
                         ${currentSessionId === session.id 
                         ? (isDark ? 'bg-dark-800 border-white/5 shadow-md' : 'bg-white border-slate-200 shadow-sm') 
                         : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                    >
                       <div className={`${currentSessionId === session.id ? (isDark ? 'text-primary-400' : 'text-primary-600') : 'text-gray-400'}`}>
                           <ChatBubbleIcon />
                       </div>
                       <div className="flex-1 overflow-hidden">
                          <h4 className={`truncate text-sm font-bold ${currentSessionId === session.id ? (isDark ? 'text-white' : 'text-slate-900') : 'opacity-70'}`}>
                              {session.title}
                          </h4>
                          <p className="truncate text-xs opacity-50 font-light">{session.preview}</p>
                       </div>
                       <button 
                         onClick={(e) => deleteSession(e, session.id)}
                         className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/10 text-red-500 rounded-lg transition"
                       >
                         <TrashIcon />
                       </button>
                    </div>
                ))}
             </div>

             <div className={`p-4 mt-auto border-t ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                 {user.isLoggedIn ? (
                     <div className={`flex items-center gap-3 p-2 rounded-xl ${isDark ? 'bg-dark-800' : 'bg-slate-100'}`}>
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-accent-500 to-primary-500 flex items-center justify-center text-white font-bold shadow-lg">
                              {user.email?.[0].toUpperCase()}
                          </div>
                          <div className="flex-1 overflow-hidden">
                              <p className="font-bold text-xs truncate">عضو مميز ✨</p>
                              <p className="text-[10px] opacity-60 truncate">{user.email}</p>
                          </div>
                     </div>
                 ) : (
                     <button onClick={() => setShowLoginModal(true)} className={`w-full py-3 text-xs font-bold rounded-xl transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10 text-primary-300' : 'bg-slate-100 hover:bg-slate-200 text-primary-600'}`}>
                         🔒 تسجيل الدخول
                     </button>
                 )}
             </div>
          </aside>
      )}

      {/* --- Main Content --- */}
      <main className="flex-1 relative flex flex-col h-full">
         
         {/* Top Bar (Chat View) */}
         {view === ViewState.CHAT && (
            <header className={`h-18 px-6 flex items-center justify-between border-b z-30 backdrop-blur-md transition-colors duration-500 ${isDark ? 'bg-dark-950/80 border-white/5' : 'bg-white/80 border-slate-100'}`}>
                <div className="flex items-center gap-4">
                   <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 -ml-2 text-gray-500"><MenuIcon /></button>
                   <div className="flex flex-col">
                       <h2 className="font-bold text-base md:text-lg flex items-center gap-2">
                           AI AMAR 
                           <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${isDark ? 'bg-primary-900/30 text-primary-300 border-primary-500/20' : 'bg-primary-50 text-primary-600 border-primary-200'}`}>
                               PRO
                           </span>
                       </h2>
                       <div className="flex items-center gap-1.5">
                           <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                           <span className="text-xs opacity-60">متصل الآن</span>
                       </div>
                   </div>
                </div>
                <div>
                    <button 
                        onClick={toggleTheme} 
                        className={`p-3 rounded-full transition-all duration-300 shadow-sm border ${isDark ? 'bg-dark-800 border-white/5 hover:bg-dark-700 text-yellow-400' : 'bg-white border-slate-100 hover:bg-slate-50 text-slate-600'}`}
                    >
                        {isDark ? <SunIcon /> : <MoonIcon />}
                    </button>
                </div>
            </header>
         )}

         {/* --- Landing View --- */}
         {view === ViewState.LANDING && (
            <div className="absolute inset-0 z-50 flex flex-col">
                <div className="absolute inset-0 z-0 overflow-hidden">
                    <img src={BG_IMAGE_URL} alt="Background" className="w-full h-full object-cover scale-105" />
                    <div className={`absolute inset-0 bg-gradient-to-t ${isDark ? 'from-dark-950 via-dark-950/70' : 'from-white via-white/40'} to-transparent`}></div>
                </div>

                <div className="relative z-10 flex-1 flex flex-col items-center justify-end pb-24 px-6 text-center animate-fade-in">
                    
                    <div className="mb-6 p-2 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl animate-bounce-gentle">
                        <img src={APP_ICON_URL} className="w-24 h-24 rounded-2xl object-cover" alt="Icon" />
                    </div>

                    <h1 className={`text-6xl md:text-8xl font-display font-bold mb-4 tracking-tighter drop-shadow-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        AI <span className={`text-transparent bg-clip-text bg-gradient-to-r ${isDark ? 'from-primary-400 to-accent-dark' : 'from-primary-600 to-accent-light'}`}>AMAR</span>
                    </h1>
                    
                    <p className={`text-lg md:text-xl max-w-xl mb-12 font-medium leading-relaxed ${isDark ? 'text-gray-300' : 'text-slate-700 drop-shadow-sm'}`}>
                        مساحتك الإبداعية الخاصة. مساعد ذكي بيفهمك، بيحس بيك، وبيساعدك تنجز أكتر. 🚀
                    </p>

                    <button 
                        onClick={startNewChat}
                        className={`group relative px-12 py-5 rounded-2xl font-bold text-xl shadow-2xl hover:scale-105 transition-all duration-300 overflow-hidden text-white
                        ${isDark 
                          ? 'bg-gradient-to-r from-primary-600 to-accent-dark shadow-primary-500/40 border border-white/10' 
                          : 'bg-gradient-to-r from-primary-600 to-primary-500 shadow-primary-500/30'}`}
                    >
                        <span className="relative z-10 flex items-center gap-3">
                            يلا نبدأ <SendIcon />
                        </span>
                        <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12"></div>
                    </button>
                    
                    <div className="absolute bottom-6 text-xs opacity-50 tracking-widest uppercase font-bold">
                        Developed by {DEVELOPER_NAME}
                    </div>
                </div>
            </div>
         )}

         {/* --- Chat View --- */}
         {view === ViewState.CHAT && (
            <div className="flex-1 flex flex-col relative overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scroll-smooth">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-in`}>
                            
                            {msg.role === 'model' && (
                                <div className="flex flex-col items-center gap-1 ml-3 self-start">
                                    <img src={ASSISTANT_AVATAR_URL} alt="Bot" className="w-10 h-10 rounded-full object-cover border-2 border-white/10 shadow-lg" />
                                    <span className="text-[10px] font-bold opacity-50">AI</span>
                                </div>
                            )}

                            <div className={`
                                max-w-[85%] md:max-w-[70%] p-5 rounded-3xl relative leading-loose text-[15px]
                                ${msg.role === 'user' ? `${userBubble} rounded-br-none` : `${modelBubble} rounded-bl-none`}
                            `}>
                                {msg.image && (
                                    <div className="mb-4 rounded-2xl overflow-hidden shadow-md border border-black/5">
                                        <img src={msg.image} alt="Content" className="w-full h-auto object-cover" />
                                    </div>
                                )}
                                
                                <div className="markdown-content">
                                    {msg.text.split('\n').map((line, i) => (
                                        <p key={i} className="min-h-[1em]">{line}</p>
                                    ))}
                                </div>

                                {msg.role === 'model' && (
                                    <div className="absolute -bottom-6 left-2 flex gap-2">
                                        <button onClick={() => {navigator.clipboard.writeText(msg.text); alert('تم النسخ! 👍')}} className="p-1.5 text-xs bg-black/5 hover:bg-black/10 rounded-full transition dark:bg-white/10 dark:hover:bg-white/20">
                                            <CopyIcon />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    
                    {isLoading && (
                        <div className="flex items-center gap-3 animate-pulse ml-4">
                             <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${isDark ? 'bg-dark-800 border-white/5' : 'bg-white border-slate-100'}`}>
                                <span className="text-lg">🤔</span>
                             </div>
                             <span className="text-xs font-bold opacity-50">بيفكر في رد عبقري...</span>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className={`p-4 md:p-6 z-20 ${isDark ? 'bg-gradient-to-t from-dark-950 to-transparent' : 'bg-gradient-to-t from-white to-transparent'}`}>
                    <div className={`backdrop-blur-xl border rounded-[2rem] p-2 shadow-2xl flex items-center gap-2 relative transition-all duration-300
                        ${isDark ? 'bg-dark-900/80 border-white/10 focus-within:border-accent-dark/50' : 'bg-white/90 border-slate-200 focus-within:border-accent-light/50'}
                    `}>
                        
                        {selectedImage && (
                            <div className="absolute bottom-full left-0 mb-4 ml-2 p-2 bg-dark-900 rounded-xl border border-white/10 animate-fade-in shadow-xl">
                                <img src={selectedImage} className="w-20 h-20 object-cover rounded-lg" />
                                <button onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs border-2 border-dark-900">✕</button>
                            </div>
                        )}

                        <button onClick={cycleImageSize} className={`hidden md:flex items-center gap-1 px-4 py-2.5 rounded-full text-xs font-bold transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10 text-primary-300' : 'bg-slate-100 text-primary-600 hover:bg-slate-200'}`}>
                            <SettingsIcon /> {imageSize}
                        </button>

                        <input type="file" id="upload" className="hidden" accept="image/*" onChange={handleImageUpload} />
                        <label htmlFor="upload" className={`p-3 rounded-full cursor-pointer transition ${isDark ? 'hover:bg-white/10 text-gray-400 hover:text-accent-dark' : 'hover:bg-slate-100 text-gray-500 hover:text-accent-light'}`}>
                            <ImageIcon />
                        </label>

                        <input 
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                            placeholder="اكتب حاجة..."
                            className={`flex-1 bg-transparent border-none outline-none text-base px-2 py-3 font-medium ${isDark ? 'placeholder-gray-600 text-white' : 'placeholder-gray-400 text-slate-800'}`}
                        />

                        <button 
                            onClick={handleSendMessage}
                            disabled={isLoading || (!input && !selectedImage)}
                            className={`p-4 rounded-full transition-all duration-300 shadow-lg flex items-center justify-center
                            ${input || selectedImage 
                                ? (isDark ? 'bg-accent-dark hover:bg-accent-500 text-black shadow-accent-500/30' : 'bg-accent-light hover:bg-orange-600 text-white shadow-orange-500/30') 
                                : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'}`}
                        >
                            <SendIcon />
                        </button>
                    </div>
                    <div className="text-center mt-3">
                         <p className="text-[10px] opacity-40 uppercase tracking-[0.2em] font-bold">AI AMAR • V2.5</p>
                    </div>
                </div>
            </div>
         )}
      </main>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
           <div className={`w-full max-w-md p-8 rounded-3xl border shadow-2xl relative overflow-hidden ${isDark ? 'bg-dark-900 border-white/10' : 'bg-white border-slate-100'}`}>
              <div className={`absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r ${isDark ? 'from-primary-600 to-accent-dark' : 'from-primary-400 to-accent-light'}`}></div>
              <h3 className="text-3xl font-bold mb-2">أهلاً بيك! 👋</h3>
              <p className="text-sm opacity-60 mb-8">عشان تفضل تستمتع بالمميزات، محتاجين نعرفك.</p>
              
              <form onSubmit={handleLogin} className="space-y-4">
                 <div className="space-y-1">
                    <label className="text-xs font-bold opacity-70 uppercase px-1">الإيميل</label>
                    <input type="email" required className={`w-full p-4 rounded-xl outline-none border transition-colors ${isDark ? 'bg-dark-950 border-white/10 focus:border-accent-dark text-white' : 'bg-slate-50 border-slate-200 focus:border-accent-light text-slate-900'}`} onChange={e => setLoginForm({...loginForm, email: e.target.value})} />
                 </div>
                 <div className="space-y-1">
                    <label className="text-xs font-bold opacity-70 uppercase px-1">الموبايل</label>
                    <input type="tel" required className={`w-full p-4 rounded-xl outline-none border transition-colors ${isDark ? 'bg-dark-950 border-white/10 focus:border-accent-dark text-white' : 'bg-slate-50 border-slate-200 focus:border-accent-light text-slate-900'}`} onChange={e => setLoginForm({...loginForm, phone: e.target.value})} />
                 </div>
                 <button type="submit" className={`w-full font-bold py-4 rounded-xl mt-4 transition-all shadow-lg ${isDark ? 'bg-accent-dark text-black hover:bg-cyan-400' : 'bg-accent-light text-white hover:bg-orange-600'}`}>يلا بينا 🚀</button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
