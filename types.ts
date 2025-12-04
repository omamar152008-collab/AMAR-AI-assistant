
export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  image?: string; // base64
  isError?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  preview: string;
  date: string;
  messages: Message[];
}

export interface UserState {
  isLoggedIn: boolean;
  email?: string;
  phone?: string;
  messageCount: number;
  theme: 'dark' | 'light';
}

export enum ViewState {
  LANDING = 'LANDING',
  CHAT = 'CHAT',
}
