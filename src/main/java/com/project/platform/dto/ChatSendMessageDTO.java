package com.project.platform.dto;

import lombok.Data;

/**
 * 发送聊天消息(POST /chat/messages)的入参。
 *
 * <p><b>发送者身份不在这里</b>:`senderId` / `senderType` 一律取自 token
 * (见 `ChatController`)。此前请求体里的 `isMerchant` 布尔已被忽略 —— 采信它等于允许伪造发送者
 * (user 与 shop 是两套独立 id 空间)。这里刻意**不声明**该字段,让客户端传了也被丢掉。
 *
 * <p>字段与既有实现从请求体里读的 key 一一对应,**不加新校验**,行为不变。
 */
@Data
public class ChatSendMessageDTO {
    /** 对端 id:买家发给店铺时是 shopId,店铺发给买家时是 userId */
    private Integer receiverId;
    private String content;
    /** 已有会话 id;缺省则按 (user, shop) 查找或新建 */
    private Integer conversationId;
    private Integer productId;
}
