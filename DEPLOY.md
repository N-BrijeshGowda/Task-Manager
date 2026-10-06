# Putting the site on the internet

The app is one Node service: Express serves the API **and** the built React site, so you host
one web service plus one MySQL database. `render.yaml` is set up for [Render](https://render.com);
any Node host works the same way (build: `npm run build`, start: `npm start`).

> Free plans change often and free web services usually **sleep when idle** (the first visit
> after a quiet period takes ~30-60 seconds). Check each provider's current free tier and terms
> before relying on it. For an always-on site, use a paid plan or a small VPS.

## 1. Get a cloud MySQL database

You need a MySQL (or MariaDB) database reachable from the internet over TLS. Providers with a
free or cheap MySQL plan include Aiven, TiDB Cloud and Railway, among others. Create one and note:

`host`, `port`, `user`, `password`, `database name`.

Then create the tables by running **`database/schema_hosted.sql`** inside that database
(the provider's SQL console, MySQL Workbench, or the `mysql` command line). Use
`schema_hosted.sql`, not `schema.sql`, because managed databases already have a fixed name.

## 2. Push the code to GitHub

```
git add -A
git commit -m "Describe your change"
git push
```

## 3. Create the web service on Render

1. Sign up at render.com and connect your GitHub account.
2. **New +** > **Blueprint**, pick the `Task-Manager` repo. Render reads `render.yaml`.
3. When asked, enter the database values from step 1: `DB_HOST`, `DB_PORT`, `DB_USER`,
   `DB_PASSWORD`, `DB_NAME`. (`JWT_SECRET` is generated for you; `DB_SSL` is already `true`.)
4. Check `TZ` in `render.yaml` is **your** timezone (default `Asia/Kolkata`). It decides when
   "today" rolls over. Use names like `Europe/London` or `America/New_York`.
5. Deploy. When it finishes, open the `https://<name>.onrender.com` link. You should see the login page.

If the deploy log says it cannot connect to MySQL, re-check the five `DB_*` values and that
the database allows connections from outside its own network (some providers have an IP allow-list).

## 4. Create your admin account

1. Open your live site and **register** the account you want to be admin.
2. Promote it by running this in the cloud database's SQL console:
   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
   ```
3. Log out and back in. An **Admin** tab now appears in the navigation bar.

Nobody can become admin from the website, only by this database change.

### What the admin can and cannot do

- **Can see:** each user's name and email, join date, last login, active/disabled, and counts
  (tasks logged, plans pending/done). An activity log (login, failed login, task added, password
  changes, admin actions...) with time, who, and IP address.
- **Can do:** disable/enable an account (**all data is kept**; the user just cannot log in), delete
  an account (permanently removes it and all its data), and **reset a password**: the admin gets a
  random temporary password shown once, tells the user, and the user must choose their own
  password at their next login. Admin accounts themselves cannot be changed from the Admin tab.
- **Cannot see:** passwords (only hashes are stored, and never sent to the admin) or any task,
  plan, or calendar note content. The admin API never selects those columns and the log never stores them.

Because admins can see names and emails, tell your users who has admin access.

## 5. After going live

- **Test it:** register a second account, add a task, then check the Admin tab shows it as a count only.
- **Backups:** your data lives in the cloud database. Turn on the provider's automatic backups.
- **HTTPS** is automatic on Render. Your own domain can be added under the service's *Settings*.
- **Updating the site:** `git push` and Render rebuilds automatically.
- **Secrets:** never commit `.env`. `JWT_SECRET` lives only in the host's dashboard.
- **Logs grow forever.** If the table gets large, delete old rows, e.g.
  `DELETE FROM activity_logs WHERE created_at < NOW() - INTERVAL 180 DAY;`
- **Privacy:** users' data is stored on your database and you are responsible for it. If you
  have real users, add a privacy notice and consider your local data-protection rules.

## Updating an existing local database

If you already ran the app locally before the admin feature was added, import
`database/migration_admin.sql` once in phpMyAdmin (select `daily_task_tracker` first). It adds the
new columns and the log table without touching your data. Then promote yourself locally with:

```
cd server
npm run make-admin -- your@email.com
```
