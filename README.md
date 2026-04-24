# Campaign Sender Studio

A local app for preparing a direct-mail prospect campaign for future Amazon Business automation.

It includes:

- flexible multi-step send sequences
- quick-add contact entry
- manual contact assignment
- campaign start-date scheduling
- Amazon Business configuration placeholders
- SMTP email automation tied to order status
- due-gift processing into local order records
- local order status tracking
- local JSON persistence

## Run it

```bash
ruby server.rb
```

Then open:

```text
http://127.0.0.1:4173/
```

If `4173` is in use, run:

```bash
PORT=4174 ruby server.rb
```

## GitHub

This repo ignores local runtime data in `campaign_data.json`.

If you want example starter data in GitHub, use:

```text
campaign_data.example.json
```

## What "Amazon Business ready" means here

This app does not place live Amazon Business orders yet. Instead, it is now structured so you can:

- save Amazon Business config values locally
- set a campaign start date
- process gifts that are due on a selected run date
- create local order records for each due gift
- track order status changes in the UI

When you later get Amazon Business Ordering API access, the backend already has a clear place to replace the current local stub with a real `placeOrder` call.

## Email automation

You can configure SMTP email settings in the app and choose one trigger:

- send email when the gift is marked sent
- send email when the gift is marked delivered

When an order status is changed to the configured trigger status, the backend attempts to send the custom email automatically.

Each send step can now define its own email subject and body, so different gifts can trigger different emails. The global email templates remain as fallbacks if a step-specific email field is left blank.

## Message template fields

Use these placeholders inside a step message:

- `{{firstName}}`
- `{{fullName}}`
- `{{company}}`
- `{{campaignName}}`
- `{{senderName}}`

The rendered step message is also copied into the generated `giftReceiptMessage` field for each order payload.

## Recipient input format

For manual paste, use one line per recipient:

```text
Full Name | email@example.com | Company | Street | City | State | Zip | Assigned To
```

You can also edit the assignment and assignment note for each contact directly in the app.

If a recipient email has appeared in prior processed orders, the app flags that contact as previously enrolled so you can review before sending again.
