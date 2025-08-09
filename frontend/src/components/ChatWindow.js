import React, { useContext } from 'react';
import { useChatContext, Channel, Window, ChannelHeader, MessageList, MessageInput } from 'stream-chat-react';
import { useParams } from 'react-router-dom';
import { AuthContext } from '../AuthContext';

const ChatWindow = () => {
    const { client } = useChatContext();
    const { authData } = useContext(AuthContext); 
    const { lawyerId } = useParams();

    if (!authData || !authData.userId) {
        return <div>Cargando información del usuario...</div>;
    }

    const channelId = `messaging-${authData.userId}-${lawyerId}`;
    const channel = client.channel('messaging', channelId, {
        name: `Chat con Abogado #${lawyerId}`,
        members: [authData.userId.toString(), lawyerId.toString()],
    });

    channel.watch();

    return (
        <Channel channel={channel}>
            <Window>
                <ChannelHeader />
                <MessageList />
                <MessageInput />
            </Window>
        </Channel>
    );
};

export default ChatWindow;