import React, { useState, useEffect, useContext } from 'react';
import { StreamChat } from 'stream-chat';
import { Chat } from 'stream-chat-react';
import { AuthContext } from '../AuthContext';

// Pon tu clave de API de Stream aquí.
const STREAM_API_KEY = "TU_API_KEY_DE_STREAM"; 

const ChatProvider = ({ children }) => {
    const { authData } = useContext(AuthContext);
    const [chatClient, setChatClient] = useState(null);

    useEffect(() => {
        if (!authData || !authData.token) {
            if (chatClient) {
                chatClient.disconnectUser();
                setChatClient(null);
            }
            return;
        }

        const client = StreamChat.getInstance(STREAM_API_KEY);

        if (client.userID !== authData.userId.toString()) {
            const connectUser = async () => {
                try {
                    const response = await fetch('/api/stream-token', {
                        headers: { 'Authorization': `Bearer ${authData.token}` }
                    });

                    if (!response.ok) throw new Error('Falló la obtención del token de Stream.');

                    const { token: streamToken } = await response.json();
                    
                    await client.connectUser(
                        {
                            id: authData.userId.toString(),
                            name: authData.userName,
                            role: authData.role,
                        },
                        streamToken 
                    );
                    
                    setChatClient(client);
                } catch (error) {
                    console.error("Error crítico al conectar con Stream Chat:", error);
                    if (client) client.disconnectUser();
                }
            };
            connectUser();
        }

    }, [authData]);

    if (!authData) {
        return <>{children}</>;
    }

    if (!chatClient) {
        return <div>Cargando chat...</div>;
    }

    return (
        <Chat client={chatClient} theme="messaging light">
            {children}
        </Chat>
    );
};

export default ChatProvider;