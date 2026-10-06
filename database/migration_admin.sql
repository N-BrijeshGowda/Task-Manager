-- Upgrade an EXISTING daily_task_tracker database to the admin version.
-- Run once (phpMyAdmin > select daily_task_tracker > Import). Safe to run twice.

USE daily_task_tracker;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role ENUM('user', 'admin') NOT NULL DEFAULT 'user' AFTER theme,
  ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER role,
  ADD COLUMN IF NOT EXISTS must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active,
  ADD COLUMN IF NOT EXISTS last_login_at DATETIME NULL AFTER must_change_password;

CREATE TABLE IF NOT EXISTS activity_logs (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id        INT UNSIGNED NULL,
  event          VARCHAR(40) NOT NULL,
  target_user_id INT UNSIGNED NULL,
  ip             VARCHAR(45) NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_logs_created (created_at),
  KEY idx_logs_event (event, created_at),
  KEY idx_logs_user (user_id, created_at)
) ENGINE=InnoDB;
