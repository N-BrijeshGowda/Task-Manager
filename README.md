# Daily Task Tracker & Scheduler

React (Vite) + Express + MySQL (XAMPP / phpMyAdmin).

## Run it (Windows + XAMPP)

1. **Start MySQL.** Open the XAMPP Control Panel and click **Start** next to **MySQL** (Apache is only needed if you want to open phpMyAdmin).
2. **Create the database.** Open http://localhost/phpmyadmin, click the **Import** tab, choose `database/schema.sql`, and click **Import**. A database called `daily_task_tracker` with 4 tables appears.
3. **Check the server settings.** `server/.env` is already set up for a default XAMPP install (user `root`, empty password). If you set a MySQL password, put it in `DB_PASSWORD`.
4. **Start the backend.** In a terminal:
   ```
   cd server
   npm install
   npm run dev
   ```
   You should see `Server running on http://localhost:5000`.
5. **Start the frontend.** In a second terminal:
   ```
   cd client
   npm install
   npm run dev
   ```
6. Open http://localhost:5173, click **Create an account**, and start using the app.

Next time, repeat steps 1, 4 and 5 only (the `npm install` is a one-off).

## Admin

Already have the database from an earlier version? In phpMyAdmin select `daily_task_tracker`, import `database/migration_admin.sql`, then restart the server.

Make yourself admin (register on the site first), then:
```
cd server
npm run make-admin -- your@email.com
```
Log out and in again and an **Admin** tab appears with: an overview, a searchable user list (name, email, activity counts; never task or plan content), disable/enable (data is kept), delete, **reset password** (a temporary password is shown once and the user must set a new one at next login), and activity logs.

## Putting it on the internet

See [DEPLOY.md](DEPLOY.md).

## How it works

- **Calendar:** green = tasks completed, blue = holiday, orange = leave, gray = weekend off, teal **W** = working Saturday, red dot = overdue planned items. Click a day to see, add, edit or delete its tasks, or to mark it Holiday / Leave / Working Saturday.
- **Planner:** things you want to achieve, due on a day or by the end of the week (Saturday if marked as a working Saturday, otherwise Friday; moved back if that day is a holiday or leave). Click the circle to mark one done and it is logged as a completed task for today. Overdue items are highlighted in red.
- **Streak:** consecutive days with a completed task. Holidays, leave, Sundays and non-working Saturdays do not break it.
- **Repeat:** daily / weekly / weekdays (weekly only for end-of-week items). Completing one creates the next.
