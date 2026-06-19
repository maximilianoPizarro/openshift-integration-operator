const fs = require('fs');
let file = fs.readFileSync('console-plugin/src/utils/templateProperties.ts', 'utf8');

const additions = `
  gmail: {
    properties: {},
    requiredSecrets: ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN'],
    authType: 'oauth2_refresh',
    hint: 'Google Cloud OAuth app with Gmail API scope.',
  },
  office365: {
    properties: {},
    requiredSecrets: ['OFFICE365_CLIENT_ID', 'OFFICE365_CLIENT_SECRET', 'OFFICE365_REFRESH_TOKEN'],
    authType: 'oauth2_refresh',
    hint: 'Azure AD app with Office365 API scope.',
  },
  teams: {
    properties: {},
    requiredSecrets: ['TEAMS_WEBHOOK_URL'],
    authType: 'oauth2_refresh',
    hint: 'Microsoft Teams webhook URL.',
  },
  whatsapp: {
    properties: {},
    requiredSecrets: ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'],
    authType: 'static_token_webhook',
    hint: 'WhatsApp Business permanent access token.',
  },
  discord: {
    properties: {},
    requiredSecrets: ['DISCORD_WEBHOOK_URL'],
    authType: 'static_token_webhook',
    hint: 'Discord Webhook URL.',
  },
  stripe: {
    properties: {},
    requiredSecrets: ['STRIPE_WEBHOOK_SECRET', 'SLACK_WEBHOOK_URL'],
    authType: 'api_key',
    hint: 'Stripe webhook secret.',
  },
  mercadopago: {
    properties: {},
    requiredSecrets: ['MERCADOPAGO_ACCESS_TOKEN'],
    authType: 'api_key',
    hint: 'Mercado Pago access token.',
  },
  openai: {
    properties: { ...OPENAI_CHAT_PROPERTIES },
    requiredSecrets: ['OPENAI_API_KEY'],
    authType: 'api_key',
    hint: 'OpenAI API Key.',
  },
  anthropic: {
    properties: {},
    requiredSecrets: ['ANTHROPIC_API_KEY'],
    authType: 'api_key',
    hint: 'Anthropic API Key.',
  },
  instagram: {
    properties: {},
    requiredSecrets: ['INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_BUSINESS_ACCOUNT_ID'],
    authType: 'oauth2_refresh',
    hint: 'Instagram Graph API token.',
  },
  linkedin: {
    properties: {},
    requiredSecrets: ['LINKEDIN_ACCESS_TOKEN'],
    authType: 'oauth2_refresh',
    hint: 'LinkedIn API token.',
  },
`;

// Also fix slack
file = file.replace(`authType: 'static_token_webhook',
    hint: 'Slack Incoming Webhook URL`, `authType: 'oauth2_refresh',
    hint: 'Slack Incoming Webhook URL`);

// Insert additions before the last '};' of COMPONENT_PROPERTIES
const insertionPoint = file.lastIndexOf('};', file.indexOf('COMPONENT_ALIASES'));
if (insertionPoint !== -1) {
  file = file.slice(0, insertionPoint) + additions + file.slice(insertionPoint);
}

fs.writeFileSync('console-plugin/src/utils/templateProperties.ts', file);
