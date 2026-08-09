-- Chat feature tables
-- Real-time messaging between customers (USER) and merchants (SHOP)

DROP TABLE IF EXISTS `message`;
DROP TABLE IF EXISTS `conversation`;

CREATE TABLE `conversation` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT 'Conversation ID',
  `user_id` INT NOT NULL COMMENT 'Customer user ID',
  `shop_id` INT NOT NULL COMMENT 'Shop/merchant ID',
  `product_id` INT DEFAULT NULL COMMENT 'Optional product context',
  `last_message` VARCHAR(500) DEFAULT NULL COMMENT 'Last message preview',
  `last_message_time` TIMESTAMP NULL COMMENT 'Time of last message',
  `user_unread_count` INT DEFAULT 0 COMMENT 'Unread count for user/customer',
  `shop_unread_count` INT DEFAULT 0 COMMENT 'Unread count for shop/merchant',
  `create_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Created time',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_shop` (`user_id`, `shop_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `message` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT 'Message ID',
  `conversation_id` INT NOT NULL COMMENT 'Conversation ID',
  `sender_id` INT NOT NULL COMMENT 'Sender ID (user or shop)',
  `sender_type` VARCHAR(10) NOT NULL COMMENT 'Sender type: USER or SHOP',
  `content` TEXT COMMENT 'Message text content',
  `type` VARCHAR(20) DEFAULT 'text' COMMENT 'Message type: text, image, attachment',
  `file_name` VARCHAR(255) DEFAULT NULL COMMENT 'Original file name',
  `file_url` VARCHAR(500) DEFAULT NULL COMMENT 'File URL',
  `is_read` TINYINT(1) DEFAULT 0 COMMENT 'Read flag',
  `create_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Sent time',
  PRIMARY KEY (`id`),
  INDEX `idx_conversation` (`conversation_id`),
  INDEX `idx_conv_time` (`conversation_id`, `create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
