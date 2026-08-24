-- ============================================================
-- V1 安全加固:明文密码 -> BCrypt
-- 日期: 2026-08-10  (与 Phase A-1 配套)
--
-- 说明:
--   * 仅将明文 '123456' 重置为 BCrypt 哈希(幂等,重复执行无副作用);
--   * 其他非 123456 的存量明文账号无法在 SQL 层逆推,请走"找回密码"流程重置;
--   * 执行含中文需加: mysql --default-character-set=utf8mb4
--   * 哈希值 = BCryptPasswordEncoder(10).encode("123456") = $2b$10$XgIBI2rnaZ.4I4rWj27B1uXkCX6L9xuJ.0jLkevXa0Scgvczw.mbW
-- ============================================================

UPDATE `user`  SET `password` = '$2b$10$XgIBI2rnaZ.4I4rWj27B1uXkCX6L9xuJ.0jLkevXa0Scgvczw.mbW' WHERE `password` = '123456';
UPDATE `admin` SET `password` = '$2b$10$XgIBI2rnaZ.4I4rWj27B1uXkCX6L9xuJ.0jLkevXa0Scgvczw.mbW' WHERE `password` = '123456';
UPDATE `shop`  SET `password` = '$2b$10$XgIBI2rnaZ.4I4rWj27B1uXkCX6L9xuJ.0jLkevXa0Scgvczw.mbW' WHERE `password` = '123456';
