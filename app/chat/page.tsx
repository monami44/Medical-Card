"use client"

import React, { useState, useRef, useEffect } from 'react';
import { useAuth, SignIn } from '@clerk/nextjs';
import { Input } from "@/lib/components/ui/input"
import { Button } from "@/lib/components/ui/button"
import { ScrollArea } from "@/lib/components/ui/scroll-area"
import Header from '@/components/Header';


const ChatPage: React.FC = () => {
  const { isLoaded, userId, getToken } = useAuth();
  const [messages, setMessages] = useState<Array<{ content: string; type: 'user' | 'bot' }>>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      setIsLoading(true);
      const newMessage = { content: input, type: 'user' as const };
      setMessages((prevMessages) => [...prevMessages, newMessage]);
      setInput('');

      try {
        const token = await getToken();
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ message: input }),
        });

        if (!response.ok) {
          throw new Error('Failed to send message');
        }

        const data = await response.json();
        setMessages((prevMessages) => [
          ...prevMessages,
          { content: data.message, type: 'bot' },
        ]);
      } catch (error) {
        console.error('Error sending message:', error);
        setMessages((prevMessages) => [
          ...prevMessages,
          { content: 'Sorry, there was an error processing your message.', type: 'bot' },
        ]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (!isLoaded) {
    return <div>Loading...</div>;
  }

  if (!userId) {
    return <SignIn />;
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-white">
      <Header />
      <div className="bg-red-600 p-4 text-white font-bold text-xl">
        Medical Chatbot
      </div>
      <div className="flex-grow overflow-hidden">
        <ScrollArea className="h-full px-4">
          <div className="py-4 space-y-4">
            {messages.map((message, index) => (
              <div key={index} className={`flex ${
                message.type === 'user' ? 'justify-end' : 'justify-start'
              }`}>
                <div className={`max-w-[70%] p-3 rounded-lg ${
                  message.type === 'user' ? 'bg-red-100' : 'bg-gray-200'
                }`}>
                  {message.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>
      <div className="p-4 border-t bg-white">
        <form onSubmit={sendMessage} className="flex space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-grow"
          />
          <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white" disabled={isLoading}>
            {isLoading ? 'Sending...' : 'Send'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatPage;