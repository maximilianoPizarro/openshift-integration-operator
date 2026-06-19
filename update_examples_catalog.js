const fs = require('fs');

let file = fs.readFileSync('docs/examples-catalog.html', 'utf8');

const regex = /id: "social",[\s\S]*?examples: \[\s*([\s\S]*?)\]/;
const match = file.match(regex);

if (match) {
  const newExamples = `
      { num: "300", name: "slack-oauth-notify", comp: "slack, log", desc: "Slack notification (Secrets: SLACK_WEBHOOK_URL)" },
      { num: "301", name: "gmail-imap-poll", comp: "imap, log", desc: "Poll Gmail inbox via IMAP (Secrets: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN)" },
      { num: "302", name: "office365-mail-sync", comp: "imap, log", desc: "Poll Office365 mailbox via IMAP (Secrets: OFFICE365_CLIENT_ID, OFFICE365_CLIENT_SECRET, OFFICE365_REFRESH_TOKEN)" },
      { num: "303", name: "teams-channel-post", comp: "http, log", desc: "Post to Microsoft Teams incoming webhook (Secrets: TEAMS_WEBHOOK_URL)" },
      { num: "304", name: "whatsapp-send-message", comp: "http, log", desc: "Send WhatsApp Business API message (Secrets: WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID)" },
      { num: "305", name: "instagram-graph-post", comp: "http, log", desc: "Publish via Instagram Graph API (Secrets: INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_BUSINESS_ACCOUNT_ID)" },
      { num: "306", name: "linkedin-share-post", comp: "http, log", desc: "Share update via LinkedIn API (Secrets: LINKEDIN_ACCESS_TOKEN)" },`;

  // Insert before the last item in social examples or at the end of it
  const replacement = match[0].replace(/\]/, `,${newExamples}\n    ]`);
  file = file.replace(match[0], replacement);
  fs.writeFileSync('docs/examples-catalog.html', file);
  console.log("Updated docs/examples-catalog.html successfully");
} else {
  console.log("Could not find social category");
}
