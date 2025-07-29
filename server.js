const WebSocket = require('ws');
const http = require('http');

// Tạo HTTP server
const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Danh sách các client kết nối theo clientId
const clients = new Map();

wss.on('connection', function connection(ws, request) {
    console.log('Có client mới kết nối từ:', request.socket.remoteAddress);
    
    // Chưa có clientId, sẽ được gán khi đăng ký
    ws.clientId = null;
    
    // Gửi thông báo chào mừng
    ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Chào mừng bạn đến với WebSocket Server! Vui lòng gửi tin nhắn register để đăng ký.',
        timestamp: new Date().toISOString()
    }));
    
    // Xử lý tin nhắn từ client
    ws.on('message', function message(data) {
        try {
            const parsedData = JSON.parse(data);
            console.log('Nhận được tin nhắn:', parsedData);
            console.log(`Client hiện tại - Role: ${ws.role}, ID: ${ws.clientId}, Type: ${parsedData.type}`);
            
            // Nếu có trường 'to', gửi tin nhắn riêng cho clientId đó
            // if (parsedData.to) {
            //     const targetClient = clients.get(parsedData.to);
            //     if (targetClient && targetClient.readyState === WebSocket.OPEN) {
            //         targetClient.send(JSON.stringify({
            //             ...parsedData,
            //             from: ws.clientId,
            //             timestamp: new Date().toISOString()
            //         }));
                    
            //         // Xác nhận với người gửi
            //         ws.send(JSON.stringify({
            //             type: 'sent',
            //             to: parsedData.to,
            //             message: `Đã gửi tin nhắn riêng cho ${parsedData.to}`,
            //             timestamp: new Date().toISOString()
            //         }));
                    
            //         console.log(`Tin nhắn từ ${ws.clientId} đã được gửi riêng cho ${parsedData.to}`);
            //     } else {
            //         ws.send(JSON.stringify({
            //             type: 'error',
            //             message: `Client ${parsedData.to} không tồn tại hoặc không online`,
            //             timestamp: new Date().toISOString()
            //         }));
            //     }
            //     return;
            // }
            
            // Xử lý các loại tin nhắn khác nhau
            console.log(`=== SWITCH CASE: ${parsedData.type} ===`);
            switch(parsedData.type) {
                case 'chat':
                    // Broadcast tin nhắn chat đến tất cả client
                    broadcast({
                        type: 'chat',
                        message: parsedData.message,
                        sender: parsedData.sender || 'Anonymous',
                        timestamp: new Date().toISOString()
                    });
                    break;
                    
                case 'register':
                    // Đăng ký client với clientId
                    ws.clientId = parsedData.clientId || generateClientId();
                    clients.set(ws.clientId, ws);
                    console.log(`Client đã đăng ký với ID: ${ws.clientId}`);
                    
                    ws.send(JSON.stringify({
                        type: 'registered',
                        clientId: ws.clientId,
                        message: `Đã đăng ký thành công với clientId: ${ws.clientId}`,
                        timestamp: new Date().toISOString()
                    }));
                    broadcastClientCount();
                    break;
                    
                case 'new_post':
                    // Xử lý post - cần có trường 'to' để gửi cho client cụ thể
                    if (!parsedData.to) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Vui lòng chỉ định clientId đích trong trường "to"',
                            timestamp: new Date().toISOString()
                        }));
                        break;
                    }
                    
                    const postTargetClient = clients.get(parsedData.to);
                    if (postTargetClient && postTargetClient.readyState === WebSocket.OPEN) {
                        const postData = {
                            type: 'new_post',
                            postId: parsedData.postId ? parsedData.postId : generatePostId(),
                            content: parsedData.content,
                            attachments: parsedData.attachments || [],
                            authorId: parsedData.authorId || ws.clientId,
                            authorName: parsedData.authorName || 'Anonymous',
                            from: ws.clientId,
                            timestamp: new Date().toISOString(),
                            metadata: parsedData.metadata || {}
                        };

                        postTargetClient.send(JSON.stringify(postData));
                        
                        // Xác nhận với bên gửi rằng post đã được gửi
                        ws.send(JSON.stringify({
                            type: 'post_sent',
                            postId: postData.postId,
                            message: `Post đã được gửi thành công đến ${parsedData.to}`,
                            timestamp: new Date().toISOString()
                        }));
                        
                        console.log(`Post từ ${ws.clientId} đã được gửi đến ${parsedData.to}`);
                    } else {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: `Client ${parsedData.to} không tồn tại hoặc không online`,
                            timestamp: new Date().toISOString()
                        }));
                    }
                    break;

                case 'comment':
                    // Xử lý comment - cần có trường 'to' để gửi cho client cụ thể
                    console.log(`Xử lý comment từ client: ${ws.clientId}`);
                    if (!parsedData.to) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Vui lòng chỉ định clientId đích trong trường "to"',
                            timestamp: new Date().toISOString()
                        }));
                        break;
                    }
                    
                    const commentTargetClient = clients.get(parsedData.to);
                    if (commentTargetClient && commentTargetClient.readyState === WebSocket.OPEN) {
                        const commentData = {
                            type: 'comment',
                            postId: parsedData.postId,
                            content: parsedData.content,
                            attachments: parsedData.attachments || [],
                            authorId: parsedData.authorId || ws.clientId,
                            authorName: parsedData.authorName || 'Anonymous',
                            URL: parsedData.URL || "",
                            from: ws.clientId,
                            timestamp: new Date().toISOString(),
                            metadata: parsedData.metadata || {}
                        };
                        
                        commentTargetClient.send(JSON.stringify(commentData));
                        console.log(`Đã gửi comment đến client ${parsedData.to}`);
                        
                        // Xác nhận với bên gửi rằng comment đã được gửi
                        ws.send(JSON.stringify({
                            type: 'comment_sent',
                            postId: commentData.postId,
                            message: `Comment đã được gửi thành công đến ${parsedData.to}`,
                            timestamp: new Date().toISOString()
                        }));
                        
                        console.log(`Comment từ ${ws.clientId} đã được gửi đến ${parsedData.to}`);
                    } else {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: `Client ${parsedData.to} không tồn tại hoặc không online`,
                            timestamp: new Date().toISOString()
                        }));
                    }
                    break;

                case 'comment_byB':
                    // Xử lý comment từ A gửi sang B hoặc từ B gửi sang A
                    console.log(`Xử lý comment từ client role: ${ws.role}, clientId: ${ws.clientId}`);
                    if (ws.role === 'B') {
                        const targetRole = 'A';
                        const commentData = {
                            type: 'comment_byB',
                            postId: parsedData.postId,
                            content: parsedData.content,
                            attachments: parsedData.attachments || [],
                            authorId: parsedData.authorId || ws.clientId,
                            authorName: parsedData.authorName || 'Anonymous',
                            URL: parsedData.URL || "",
                            commentFbId: parsedData.commentFbId || parsedData.id_facebookComment ||"1",
                            timestamp: new Date().toISOString(),
                            metadata: parsedData.metadata || {}
                        };
                        console.log('comment_byB gửi sang A:', commentData);
                        // Gửi comment đến tất cả client có role còn lại
                        const sentCount = broadcastToRole(targetRole, commentData);
                        console.log(`Đã gửi comment đến ${sentCount} client role ${targetRole}`);
                        // Xác nhận với bên gửi rằng comment đã được gửi
                        ws.send(JSON.stringify({
                            type: 'comment_sent',
                            postId: commentData.postId,
                            message: `Comment đã được gửi thành công đến bên ${targetRole}`,
                            sentToClients: sentCount,
                            timestamp: new Date().toISOString()
                        }));
                        console.log(`Comment từ ${ws.clientId} đã được gửi đến ${sentCount} client role ${targetRole}`);
                    } else {
                        console.log(`Client ${ws.clientId} với role ${ws.role} không được phép gửi comment`);
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: `Chỉ client role A hoặc B mới có thể gửi comment. Role hiện tại: ${ws.role || 'chưa đăng ký'}`,
                            timestamp: new Date().toISOString()
                        }));
                    }
                    break;

                case 'URL_post':
                    console.log(`Xử lý URL_post từ client: ${ws.clientId}`);
                    if (!parsedData.to) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Vui lòng chỉ định clientId đích trong trường "to"',
                            timestamp: new Date().toISOString()
                        }));
                        break;
                    }

                    const urlTargetClient = clients.get(parsedData.to);
                    if (urlTargetClient && urlTargetClient.readyState === WebSocket.OPEN) {
                        const URLData = {
                            type: 'URL_post',
                            URL: parsedData.URL || parsedData.linkURL,
                            postId: parsedData.postId,
                            authorName: parsedData.authorName || 'Anonymous',
                            from: ws.clientId,
                            timestamp: new Date().toISOString(),
                        };
                        console.log('Dữ liệu URL sẽ gửi:', URLData);
                        
                        urlTargetClient.send(JSON.stringify(URLData));
                        console.log(`Đã gửi URL đến client ${parsedData.to}`);
                        
                        // Xác nhận với bên gửi rằng URL đã được gửi
                        ws.send(JSON.stringify({
                            type: 'URL_post_sent',
                            URL: URLData.URL,
                            message: `URL đã được gửi thành công đến ${parsedData.to}`,
                            timestamp: new Date().toISOString()
                        }));
                        
                        console.log(`URL từ ${ws.clientId} đã được gửi đến ${parsedData.to}`);
                    } else {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: `Client ${parsedData.to} không tồn tại hoặc không online`,
                            timestamp: new Date().toISOString()
                        }));
                    }
                    break;


                case 'reply_comment':
                    // Xử lý reply_comment - cần có trường 'to' để gửi cho client cụ thể
                    console.log(`Xử lý reply_comment từ client: ${ws.clientId}`);
                    if (!parsedData.to) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Vui lòng chỉ định clientId đích trong trường "to"',
                            timestamp: new Date().toISOString()
                        }));
                        break;
                    }
                    
                    const replyTargetClient = clients.get(parsedData.to);
                    if (replyTargetClient && replyTargetClient.readyState === WebSocket.OPEN) {
                        const replyCommentData = {
                            type: 'reply_comment',
                            postId: parsedData.postId,
                            commentId: parsedData.commentId,
                            content: parsedData.content,
                            attachments: parsedData.attachments || [],
                            authorId: parsedData.authorId || ws.clientId,
                            authorName: parsedData.authorName || 'Anonymous',
                            URL: parsedData.URL,
                            from: ws.clientId,
                            timestamp: new Date().toISOString(),
                            metadata: parsedData.metadata || {}
                        };
                        
                        replyTargetClient.send(JSON.stringify(replyCommentData));
                        console.log(`Đã gửi reply_comment đến client ${parsedData.to}`);
                        
                        // Xác nhận với bên gửi rằng reply_comment đã được gửi
                        ws.send(JSON.stringify({
                            type: 'reply_comment_sent',
                            postId: replyCommentData.postId,
                            commentId: replyCommentData.commentId,
                            message: `reply_comment đã được gửi thành công đến ${parsedData.to}`,
                            timestamp: new Date().toISOString()
                        }));
                        
                        console.log(`reply_comment từ ${ws.clientId} đã được gửi đến ${parsedData.to}`);
                    } else {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: `Client ${parsedData.to} không tồn tại hoặc không online`,
                            timestamp: new Date().toISOString()
                        }));
                    }
                    break;

                case 'reply_comment_byB':
                    console.log(`Xử lý reply_comment từ client role: ${ws.role}, clientId: ${ws.clientId}`);
                    if (ws.role === 'B') {
                        const targetRole = 'A';
                        const replyCommentData = {
                            type: 'reply_comment_byB',
                            postId: parsedData.postId,
                            commentId: parsedData.commentId,
                            replyId: parsedData.replyCommentId || "1",
                            content: parsedData.content,
                            attachments: parsedData.attachments || [],
                            authorId: parsedData.authorId || ws.clientId,
                            authorName: parsedData.authorName || 'Anonymous',
                            URL: parsedData.URL,
                            timestamp: new Date().toISOString(),
                            metadata: parsedData.metadata || {}
                        };
                        console.log('reply_comment_byB gửi sang A:', replyCommentData);
                        // Gửi reply_comment đến tất cả client có role còn lại
                        const sentCount = broadcastToRole(targetRole, replyCommentData);
                        console.log(`Đã gửi reply_comment đến ${sentCount} client role ${targetRole}`);
                        // Xác nhận với bên gửi rằng reply_comment đã được gửi
                    } else {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Vui lòng sử dụng type "reply_comment" với trường "to" để chỉ định client đích',
                            timestamp: new Date().toISOString()
                        }));
                    }
                    
                    break;


                case 'reply_reply_comment':
                    // Xử lý reply_reply_comment - cần có trường 'to' để gửi cho client cụ thể
                    console.log(`Xử lý reply_reply_comment từ client: ${ws.clientId}`);
                    if (!parsedData.to) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Vui lòng chỉ định clientId đích trong trường "to"',
                            timestamp: new Date().toISOString()
                        }));
                        break;
                    }

                    const replyReplyTargetClient = clients.get(parsedData.to);
                    if (replyReplyTargetClient && replyReplyTargetClient.readyState === WebSocket.OPEN) {
                        const replyReplyCommentData = {
                            type: 'reply_reply_comment',
                            postId: parsedData.postId || generatePostId(),
                            commentId: parsedData.commentId,
                            replyId: parsedData.replyId,
                            content: parsedData.content,
                            attachments: parsedData.attachments || [],
                            authorId: parsedData.authorId || ws.clientId,
                            authorName: parsedData.authorName || 'Anonymous',
                            URL: parsedData.URL,
                            from: ws.clientId,
                            timestamp: new Date().toISOString(),
                            metadata: parsedData.metadata || {}
                        };
                        
                        replyReplyTargetClient.send(JSON.stringify(replyReplyCommentData));
                        console.log(`Đã gửi reply_reply_comment đến client ${parsedData.to}`);
                        
                        // Xác nhận với bên gửi
                        ws.send(JSON.stringify({
                            type: 'reply_reply_comment_sent',
                            postId: replyReplyCommentData.postId,
                            commentId: replyReplyCommentData.commentId,
                            message: `reply_reply_comment đã được gửi thành công đến ${parsedData.to}`,
                            timestamp: new Date().toISOString()
                        }));
                        
                        console.log(`reply_reply_comment từ ${ws.clientId} đã được gửi đến ${parsedData.to}`);
                    } else {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: `Client ${parsedData.to} không tồn tại hoặc không online`,
                            timestamp: new Date().toISOString()
                        }));
                    }
                    break;

                case 'comment_result':
                    // Xử lý comment_result - cần có trường 'to'
                    console.log(`Xử lý comment_result từ client: ${ws.clientId}`);
                    console.log('Dữ liệu comment_result nhận được:', parsedData);
                    if (!parsedData.to) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Vui lòng chỉ định clientId đích trong trường "to"',
                            timestamp: new Date().toISOString()
                        }));
                        break;
                    }
                    
                    const commentResultTargetClient = clients.get(parsedData.to);
                    if (commentResultTargetClient && commentResultTargetClient.readyState === WebSocket.OPEN) {
                        const commentResultData = {
                            type: 'comment_result',
                            URL: parsedData.URL,
                            status: parsedData.status,
                            content: parsedData.content,
                            postId: parsedData.postId,
                            comment_id: parsedData.comment_id,
                            authorName: parsedData.authorName,
                            from: ws.clientId,
                            timestamp: new Date().toISOString(),
                        };
                        console.log('Dữ liệu comment_result sẽ gửi:', commentResultData);
                        
                        commentResultTargetClient.send(JSON.stringify(commentResultData));
                        console.log(`Đã gửi comment_result đến client ${parsedData.to}`);
                        
                        // Xác nhận với bên gửi
                        ws.send(JSON.stringify({
                            type: 'comment_result_sent',
                            message: `comment_result đã được gửi thành công đến ${parsedData.to}`,
                            timestamp: new Date().toISOString()
                        }));
                        
                        console.log(`comment_result từ ${ws.clientId} đã được gửi đến ${parsedData.to}`);
                    } else {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: `Client ${parsedData.to} không tồn tại hoặc không online`,
                            timestamp: new Date().toISOString()
                        }));
                    }
                    break;

                case 'reply_comment_result':
                    // Xử lý reply_comment_result - cần có trường 'to'
                    console.log(`Xử lý reply_comment_result từ client: ${ws.clientId}`);
                    console.log('Dữ liệu reply_comment_result nhận được:', parsedData);
                    if (!parsedData.to) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Vui lòng chỉ định clientId đích trong trường "to"',
                            timestamp: new Date().toISOString()
                        }));
                        break;
                    }
                    
                    const replyCommentResultTargetClient = clients.get(parsedData.to);
                    if (replyCommentResultTargetClient && replyCommentResultTargetClient.readyState === WebSocket.OPEN) {
                        const replyCommentResultData = {
                            type: 'reply_comment_result',
                            URL: parsedData.URL,
                            status: parsedData.status,
                            postId: parsedData.postId,
                            commentId: parsedData.commentId,
                            authorName: parsedData.authorName,
                            replyId: parsedData.replyId,
                            timestamp: new Date().toISOString(),
                        };
                        console.log('Dữ liệu sẽ gửi:', replyCommentResultData);
                        
                        replyCommentResultTargetClient.send(JSON.stringify(replyCommentResultData));
                        console.log(`Đã gửi reply_comment_result đến client ${parsedData.to}`);
                        
                        // Xác nhận với bên gửi
                        ws.send(JSON.stringify({
                            type: 'reply_comment_result_sent',
                            message: `reply_comment_result đã được gửi thành công đến ${parsedData.to}`,
                            timestamp: new Date().toISOString()
                        }));
                        
                        console.log(`reply_comment_result từ ${ws.clientId} đã được gửi đến ${parsedData.to}`);
                    } else {
                        console.log(`Client ${ws.clientId} với role ${ws.role} không được phép gửi reply_comment_result`);
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Vui lòng chỉ định clientId đích trong trường "to"',
                            timestamp: new Date().toISOString()
                        }));
                    }
                    break;

                case 'reply_reply_comment_result':
                    // Xử lý reply_reply_comment_result - cần có trường 'to'
                    console.log(`Xử lý reply_reply_comment_result từ client: ${ws.clientId}`);
                    console.log('Dữ liệu reply_reply_comment_result nhận được:', parsedData);
                    if (!parsedData.to) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Vui lòng chỉ định clientId đích trong trường "to"',
                            timestamp: new Date().toISOString()
                        }));
                        break;
                    }
                    
                    const replyReplyCommentResultTargetClient = clients.get(parsedData.to);
                    if (replyReplyCommentResultTargetClient && replyReplyCommentResultTargetClient.readyState === WebSocket.OPEN) {
                        const replyReplyCommentResultData = {
                            type: 'reply_reply_comment_result',
                            URL: parsedData.URL,
                            status: parsedData.status,
                            postId: parsedData.postId,
                            commentId: parsedData.commentId,
                            authorName: parsedData.authorName,
                            replyId: parsedData.reply_to_reply_id,
                            from: ws.clientId,
                            timestamp: new Date().toISOString(),
                        };
                        console.log(`Dữ liệu ${parsedData.type} sẽ gửi:`, replyReplyCommentResultData);
                        
                        replyReplyCommentResultTargetClient.send(JSON.stringify(replyReplyCommentResultData));
                        console.log(`Đã gửi ${parsedData.type} đến client ${parsedData.to}`);
                        
                        // Xác nhận với bên gửi
                        ws.send(JSON.stringify({
                            type: `${parsedData.type}_sent`,
                            message: `${parsedData.type} đã được gửi thành công đến ${parsedData.to}`,
                            timestamp: new Date().toISOString()
                        }));
                        
                        console.log(`${parsedData.type} từ ${ws.clientId} đã được gửi đến ${parsedData.to}`);
                    } else {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: `Client ${parsedData.to} không tồn tại hoặc không online`,
                            timestamp: new Date().toISOString()
                        }));
                    }
                    break;
                    
                    
                default:
                    // Echo lại tin nhắn không xác định
                    ws.send(JSON.stringify({
                        type: 'echo',
                        originalMessage: parsedData,
                        timestamp: new Date().toISOString()
                    }));
            }
        } catch (error) {
            console.error('Lỗi khi xử lý tin nhắn:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Định dạng tin nhắn không hợp lệ',
                timestamp: new Date().toISOString()
            }));
        }
    });
    
    // Xử lý khi client ngắt kết nối
    ws.on('close', function close() {
        console.log('Client đã ngắt kết nối');
        if (ws.clientId) {
            clients.delete(ws.clientId);
            console.log(`Client ${ws.clientId} đã bị xóa khỏi danh sách`);
        }
        broadcastClientCount();
    });
    
    // Xử lý lỗi
    ws.on('error', function error(err) {
        console.error('Lỗi WebSocket:', err);
        if (ws.clientId) {
            clients.delete(ws.clientId);
        }
    });
});

// Hàm broadcast tin nhắn đến tất cả client (trừ client gửi nếu có excludeClientId)
function broadcast(message, excludeClientId = null) {
    const messageString = JSON.stringify(message);
    clients.forEach(function each(client, clientId) {
        if (client.readyState === WebSocket.OPEN && clientId !== excludeClientId) {
            client.send(messageString);
        }
    });
}

// Broadcast số lượng client hiện tại
function broadcastClientCount() {
    const connectedClients = Array.from(clients.keys());
    
    broadcast({
        type: 'clientCount',
        total: clients.size,
        connectedClients: connectedClients,
        timestamp: new Date().toISOString()
    });
}

// Broadcast tin nhắn đến clients có role cụ thể
function broadcastToRole(targetRole, message) {
    const messageString = JSON.stringify(message);
    let sentCount = 0;
    
    clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN && client.role === targetRole) {
            client.send(messageString);
            sentCount++;
        }
    });
    
    console.log(`Đã gửi tin nhắn đến ${sentCount} client role ${targetRole}`);
    return sentCount;
}

// Tạo ID ngẫu nhiên cho client
function generateClientId() {
    return 'client_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

// Tạo ID ngẫu nhiên cho post
function generatePostId() {
    return 'post_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

// Khởi động server
const PORT = process.env.PORT || 3001;
server.listen(PORT, function() {
    console.log(`WebSocket Server đang chạy trên port ${PORT}`);
    console.log(`Truy cập: ws://localhost:${PORT}`);
    console.log('=== SERVER STARTED - LOG TEST ===');
});

// Xử lý tín hiệu dừng server
process.on('SIGTERM', () => {
    console.log('Đang dừng server...');
    server.close(() => {
        console.log('Server đã dừng');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('Đang dừng server...');
    server.close(() => {
        console.log('Server đã dừng');
        process.exit(0);
    });
});
