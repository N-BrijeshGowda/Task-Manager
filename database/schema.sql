-- Daily Task Tracker & Scheduler - database schema
-- Import this file in phpMyAdmin (Import tab) or run it from the SQL tab.

CREATE DATABASE IF NOT EXISTS daily_task_tracker
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE daily_task_tracker;

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  theme         ENUM('light', 'dark') NOT NULL DEFAULT 'light',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

-- Completed tasks (the daily log). The calendar turns green from these rows.
CREATE TABLE IF NOT EXISTS tasks (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  title       VARCHAR(200) NOT NULL,
  description TEXT NULL,
  task_date   DATE NOT NULL,
  priority    ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
  planned_id  INT UNSIGNED NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tasks_user_date (user_id, task_date),
  CONSTRAINT fk_tasks_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Things the user wants to achieve (the scheduler / planner).
CREATE TABLE IF NOT EXISTS planned_tasks (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED NOT NULL,
  title        VARCHAR(200) NOT NULL,
  description  TEXT NULL,
  due_date     DATE NOT NULL,
  scope        ENUM('day', 'week') NOT NULL DEFAULT 'day',
  priority     ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
  status       ENUM('pending', 'done') NOT NULL DEFAULT 'pending',
  recurrence   ENUM('none', 'daily', 'weekly', 'weekdays') NOT NULL DEFAULT 'none',
  completed_at DATETIME NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_planned_user_status_due (user_id, status, due_date),
  CONSTRAINT fk_planned_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Manual day markers: holiday, leave, or a Saturday that is a working day.
CREATE TABLE IF NOT EXISTS day_settings (
  id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  date    DATE NOT NULL,
  type    ENUM('holiday', 'leave', 'working_saturday') NOT NULL,
  note    VARCHAR(150) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_day_user_date (user_id, date),
  CONSTRAINT fk_day_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;
