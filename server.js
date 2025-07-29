const WebSocket = require('ws');
const http = require('http');

// Tạo HTTP server
const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Danh sách các client kết nối
const clients = new Set();

wss.on('connection', function connection(ws, request) {
    console.log('Có client mới kết nối từ:', request.socket.remoteAddress);
    
    // Thêm client vào danh sách
    clients.add(ws);
    
    // Gửi thông báo chào mừng
    ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Chào mừng bạn đến với WebSocket Server!',
        timestamp: new Date().toISOString()
    }));
    
    // Broadcast số lượng client hiện tại
    broadcastClientCount();
    
    // Xử lý tin nhắn từ client
    ws.on('message', function message(data) {
        try {
            const parsedData = JSON.parse(data);
            console.log('Nhận được tin nhắn:', parsedData);
            console.log(`Client hiện tại - Role: ${ws.role}, ID: ${ws.clientId}, Type: ${parsedData.type}`);
            
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
                    // Đăng ký client với role (A hoặc B)
                    ws.role = parsedData.role; // 'A' hoặc 'B'
                    ws.clientId = parsedData.clientId || generateClientId();
                    console.log(`Client đã đăng ký với role: ${ws.role}, ID: ${ws.clientId}`);
                    
                    ws.send(JSON.stringify({
                        type: 'registered',
                        role: ws.role,
                        clientId: ws.clientId,
                        message: `Đã đăng ký thành công với role ${ws.role}`,
                        timestamp: new Date().toISOString()
                    }));
                    break;
                    
                case 'facebook_post':
                    // Xử lý post kiểu facebook_post từ bên A gửi sang bên B
                    if (ws.role === 'A') {
                        const fbPostData = {
                            type: 'new_facebook_post',
                            data: parsedData.data,
                            senderId: ws.clientId,  
                            timestamp: new Date().toISOString()
                        };
                        broadcastToRole('B', fbPostData);
                        ws.send(JSON.stringify({
                            type: 'facebook_post_sent',
                            message: 'Facebook post đã được gửi thành công đến bên B',
                            timestamp: new Date().toISOString()
                        }));
                        console.log(`Facebook post từ ${ws.clientId} đã được gửi đến các client role B`);
                    } else {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Chỉ client role A mới có thể gửi facebook_post',
                            timestamp: new Date().toISOString()
                        }));
                    }
                    break;

                case 'post':
                    // Xử lý post từ bên A gửi sang bên B
                    if (ws.role === 'A') {
                        const postData = {
                            type: 'new_post',
                            postId: parsedData.postId ? parsedData.postId : generatePostId(),
                            content: parsedData.content,
                            attachments: parsedData.attachments || [],
                            authorId: parsedData.authorId || ws.clientId,
                            authorName: parsedData.authorName || 'Anonymous',
                            timestamp: new Date().toISOString(),
                            metadata: parsedData.metadata || {}
                        };

                    
                        // Gửi post đến tất cả client có role B
                        broadcastToRole('B', postData);
                        
                        // Xác nhận với bên A rằng post đã được gửi
                        ws.send(JSON.stringify({
                            type: 'post_sent',
                            postId: postData.postId,
                            message: 'Post đã được gửi thành công đến bên B',
                            timestamp: new Date().toISOString()
                        }));
                        
                        console.log(`Post từ ${ws.clientId} đã được gửi đến các client role B`);
                    } else {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Chỉ client role A mới có thể gửi post',
                            timestamp: new Date().toISOString()
                        }));
                    }
                    break;

                case 'comment':
                    // Xử lý comment từ A gửi sang B hoặc từ B gửi sang A
                    console.log(`Xử lý comment từ client role: ${ws.role}, clientId: ${ws.clientId}`);
                    if (ws.role === 'A') {
                        const targetRole = 'B';
                        const commentData = {
                            type: 'comment',
                            postId: parsedData.postId,
                            content: parsedData.content,
                            attachments: parsedData.attachments || [],
                            authorId: parsedData.authorId || ws.clientId,
                            authorName: parsedData.authorName || 'Anonymous',
                            URL: parsedData.URL || "",
                            timestamp: new Date().toISOString(),
                            metadata: parsedData.metadata || {}
                        };
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
                    // Bên B gửi URL sang cho bên A
                    console.log(`Xử lý URL từ client role: ${ws.role}, clientId: ${ws.clientId}`);
                    console.log('Dữ liệu URL nhận được:', parsedData);
                    if (ws.role === 'B') {
                        const URLData = {
                            type: 'URL_post',
                            URL: parsedData.URL || parsedData.linkURL,
                            postId: parsedData.postId,
                            authorName: parsedData.authorName || 'Anonymous',
                            timestamp: new Date().toISOString(),
                        };
                        console.log('Dữ liệu URL sẽ gửi:', URLData);
                        
                        // Gửi URL đến tất cả client có role A
                        const sentCount = broadcastToRole('A', URLData);
                        console.log(`Đã gửi URL đến ${sentCount} client role A`);
                        
                        // Xác nhận với bên B rằng URL đã được gửi
                        ws.send(JSON.stringify({
                            type: 'URL_post_sent',
                            URL: URLData.URL,
                            message: 'URL đã được gửi thành công đến bên A',
                            sentToClients: sentCount,
                            timestamp: new Date().toISOString()
                        }));
                        
                        console.log(`URL từ ${ws.clientId} đã được gửi đến ${sentCount} client role A`);
                    } else {
                        console.log(`Client ${ws.clientId} với role ${ws.role} không được phép gửi URL`);
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: `Chỉ client role B mới có thể gửi URL. Role hiện tại: ${ws.role || 'chưa đăng ký'}`,
                            timestamp: new Date().toISOString()
                        }));
                    }
                    break;


                case 'reply_comment':
                    // Xử lý reply_comment từ A gửi sang B hoặc từ B gửi sang A
                    console.log(`Xử lý reply_comment từ client role: ${ws.role}, clientId: ${ws.clientId}`);
                    if (ws.role === 'A') {
                        const targetRole = 'B';
                        const replyCommentData = {
                            type: 'reply_comment',
                            postId: parsedData.postId,
                            commentId: parsedData.commentId,
                            content: parsedData.content,
                            attachments: parsedData.attachments || [],
                            authorId: parsedData.authorId || ws.clientId,
                            authorName: parsedData.authorName || 'Anonymous',
                            URL: parsedData.URL,
                            timestamp: new Date().toISOString(),
                            metadata: parsedData.metadata || {}
                        };
                        // Gửi reply_comment đến tất cả client có role còn lại
                        const sentCount = broadcastToRole(targetRole, replyCommentData);
                        console.log(`Đã gửi reply_comment đến ${sentCount} client role ${targetRole}`);
                        // Xác nhận với bên gửi rằng reply_comment đã được gửi
                        ws.send(JSON.stringify({
                            type: 'reply_comment_sent',
                            postId: replyCommentData.postId,
                            commentId: replyCommentData.commentId,
                            message: `reply_comment đã được gửi thành công đến bên ${targetRole}`,
                            sentToClients: sentCount,
                            timestamp: new Date().toISOString()
                        }));
                        console.log(`reply_comment từ ${ws.clientId} đã được gửi đến ${sentCount} client role ${targetRole}`);
                    } else {
                        console.log(`Client ${ws.clientId} với role ${ws.role} không được phép gửi reply_comment`);
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: `Chỉ client role A hoặc B mới có thể gửi reply_comment. Role hiện tại: ${ws.role || 'chưa đăng ký'}`,
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
                        ws.send(JSON.stringify({
                            type: 'reply_comment_sent',
                            postId: replyCommentData.postId,
                            commentId: replyCommentData.commentId,
                            message: `reply_comment đã được gửi thành công đến bên ${targetRole}`,
                            sentToClients: sentCount,
                            timestamp: new Date().toISOString()
                        }));
                        console.log(`reply_comment từ ${ws.clientId} đã được gửi đến ${sentCount} client role ${targetRole}`);
                    } else {
                        console.log(`Client ${ws.clientId} với role ${ws.role} không được phép gửi reply_comment`);
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: `Chỉ client role A hoặc B mới có thể gửi reply_comment. Role hiện tại: ${ws.role || 'chưa đăng ký'}`,
                            timestamp: new Date().toISOString()
                        }));
                    }
                    break;

                case 'reply_reply_comment':
                    // Xử lý reply_reply_comment từ bên A gửi sang bên B
                    console.log(`Xử lý reply_reply_comment từ client role: ${ws.role}, clientId: ${ws.clientId}`);
                    if (ws.role === 'A') {
                        const replyCommentData = {
                            type: 'reply_reply_comment',
                            postId: parsedData.postId || generatePostId(),
                            commentId: parsedData.commentId,
                            replyId: parsedData.replyId,
                            content: parsedData.content,
                            attachments: parsedData.attachments || [],
                            authorId: parsedData.authorId || ws.clientId,
                            authorName: parsedData.authorName || 'Anonymous',
                            URL: parsedData.URL,
                            timestamp: new Date().toISOString(),
                            metadata: parsedData.metadata || {}
                        };
                        
                        // Gửi reply_reply_comment đến tất cả client có role B
                        const sentCount = broadcastToRole('B', replyCommentData);
                        console.log(`Đã gửi reply_reply_comment đến ${sentCount} client role B`);
                        
                        // Xác nhận với bên A rằng reply_reply_comment đã được gửi
                        ws.send(JSON.stringify({
                            type: 'reply_reply_comment_sent',
                            postId: replyCommentData.postId,
                            commentId: replyCommentData.commentId,
                            message: 'reply_reply_comment đã được gửi thành công đến bên B',
                            sentToClients: sentCount,
                            timestamp: new Date().toISOString()
                        }));
                        
                        console.log(`reply_reply_comment từ ${ws.clientId} đã được gửi đến ${sentCount} client role B`);
                    } else {
                        console.log(`Client ${ws.clientId} với role ${ws.role} không được phép gửi reply_reply_comment`);
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: `Chỉ client role A mới có thể gửi reply_reply_comment. Role hiện tại: ${ws.role || 'chưa đăng ký'}`,
                            timestamp: new Date().toISOString()
                        }));
                    }
                    break;

                case 'comment_result':
                    // Bên B gửi comment_id sang cho bên A
                    console.log(`Xử lý comment từ client role: ${ws.role}, clientId: ${ws.clientId}`);
                    console.log('Dữ liệu comment nhận được:', parsedData);
                    if (ws.role === 'B') {
                        const commentResultData = {
                            type: 'comment_result',
                            URL: parsedData.URL,
                            status: parsedData.status,
                            content: parsedData.content,
                            postId: parsedData.postId,
                            comment_id: parsedData.comment_id,
                            authorName: parsedData.authorName,
                            timestamp: new Date().toISOString(),
                        };
                        console.log('Dữ liệu URL sẽ gửi:', commentResultData);
                        
                        // Gửi comment_id đến tất cả client có role A
                        const sentCount = broadcastToRole('A', commentResultData);
                        console.log(`Đã gửi URL đến ${sentCount} client role A`);
                        
                        // Xác nhận với bên B rằng comment_id đã được gửi
                        ws.send(JSON.stringify({
                            type: 'comment_result_sent',
                            message: 'comment_result đã được gửi thành công đến bên A',
                            sentToClients: sentCount,
                            timestamp: new Date().toISOString()
                        }));
                        
                        console.log(`comment_result từ ${ws.clientId} đã được gửi đến ${sentCount} client role A`);
                    } else {
                        console.log(`Client ${ws.clientId} với role ${ws.role} không được phép gửi comment_result`);
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: `Chỉ client role B mới có thể gửi comment_result. Role hiện tại: ${ws.role || 'chưa đăng ký'}`,
                            timestamp: new Date().toISOString()
                        }));
                    }
                    break;

                case 'reply_comment_result':
                    // Bên B gửi comment_id sang cho bên A
                    console.log(`Xử lý reply_comment từ client role: ${ws.role}, clientId: ${ws.clientId}`);
                    console.log('Dữ liệu reply_comment nhận được:', parsedData);
                    if (ws.role === 'B') {
                        const repltCommentResultData = {
                            type: 'reply_comment_result',
                            URL: parsedData.reply_url,
                            status: parsedData.status,
                            postId: parsedData.postId,
                            commentId: parsedData.commentId,
                            authorName: parsedData.authorName,
                            replyId: parsedData.reply_id,
                            timestamp: new Date().toISOString(),
                        };
                        console.log('Dữ liệu sẽ gửi:', repltCommentResultData);
                        
                        // Gửi comment_id đến tất cả client có role A
                        const sentCount = broadcastToRole('A', repltCommentResultData);
                        console.log(`Đã gửi đến ${sentCount} client role A`);
                        
                        // Xác nhận với bên B rằng comment_id đã được gửi
                        ws.send(JSON.stringify({
                            type: 'reply_comment_result_sent',
                            message: 'reply_comment_result đã được gửi thành công đến bên A',
                            sentToClients: sentCount,
                            timestamp: new Date().toISOString()
                        }));
                        
                        console.log(`reply_comment_result từ ${ws.clientId} đã được gửi đến ${sentCount} client role A`);
                    } else {
                        console.log(`Client ${ws.clientId} với role ${ws.role} không được phép gửi reply_comment_result`);
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: `Chỉ client role B mới có thể gửi reply_comment_result. Role hiện tại: ${ws.role || 'chưa đăng ký'}`,
                            timestamp: new Date().toISOString()
                        }));
                    }
                    break;

                case 'reply_reply_comment_result':
                    // Bên B gửi comment_id sang cho bên A
                    console.log(`Xử lý reply_reply_comment từ client role: ${ws.role}, clientId: ${ws.clientId}`);
                    console.log('Dữ liệu reply_reply_comment nhận được:', parsedData);
                    if (ws.role === 'B') {
                        const repltCommentResultData = {
                            type: 'reply_reply_comment_result',
                            URL: parsedData.reply_to_reply_url,
                            status: parsedData.status,
                            postId: parsedData.postId,
                            commentId: parsedData.commentId,
                            authorName: parsedData.authorName,
                            replyId: parsedData.reply_to_reply_id,
                            timestamp: new Date().toISOString(),
                        };
                        console.log('Dữ liệu sẽ gửi:', repltCommentResultData);
                        
                        // Gửi comment_id đến tất cả client có role A
                        const sentCount = broadcastToRole('A', repltCommentResultData);
                        console.log(`Đã gửi đến ${sentCount} client role A`);
                        
                        // Xác nhận với bên B rằng comment_id đã được gửi
                        ws.send(JSON.stringify({
                            type: 'reply_reply_comment_result_sent',
                            message: 'reply_reply_comment_result đã được gửi thành công đến bên A',
                            sentToClients: sentCount,
                            timestamp: new Date().toISOString()
                        }));
                        
                        console.log(`reply_reply_comment_result từ ${ws.clientId} đã được gửi đến ${sentCount} client role A`);
                    } else {
                        console.log(`Client ${ws.clientId} với role ${ws.role} không được phép gửi reply_reply_comment_result`);
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: `Chỉ client role B mới có thể gửi reply_reply_comment_result. Role hiện tại: ${ws.role || 'chưa đăng ký'}`,
                            timestamp: new Date().toISOString()
                        }));
                    }
                    break;
                    
                case 'ping':
                    // Phản hồi pong
                    ws.send(JSON.stringify({
                        type: 'pong',
                        timestamp: new Date().toISOString()
                    }));
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
        clients.delete(ws);
        broadcastClientCount();
    });
    
    // Xử lý lỗi
    ws.on('error', function error(err) {
        console.error('Lỗi WebSocket:', err);
        clients.delete(ws);
    });
});

// Hàm broadcast tin nhắn đến tất cả client
function broadcast(message) {
    const messageString = JSON.stringify(message);
    clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(messageString);
        }
    });
}

// Broadcast số lượng client hiện tại
function broadcastClientCount() {
    const roleACounts = Array.from(clients).filter(client => client.role === 'A').length;
    const roleBCounts = Array.from(clients).filter(client => client.role === 'B').length;
    
    broadcast({
        type: 'clientCount',
        total: clients.size,
        roleA: roleACounts,
        roleB: roleBCounts,
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
