# Daily Status Reporter

A static page (no backend) that collects tasks — Date, Task context, Task sub context, Description, Hours — and posts them to a Google Chat space as one formatted card with your name.

## Deploy on GitHub Pages
1. Push this repo to GitHub.
2. Settings → Pages → Source: *Deploy from a branch* → `main` / `/ (root)`.
3. Open `https://<user>.github.io/<repo>/`.

## Use
1. In Google Chat: space → Apps & integrations → Add webhooks → copy the URL.
2. Open the page, enter your name and webhook URL (stored only in your browser's localStorage).
3. Add tasks (or copy rows from Excel and click **Paste rows from Excel**), then **Send to Google Chat**.

Never commit your webhook URL to the repo.
