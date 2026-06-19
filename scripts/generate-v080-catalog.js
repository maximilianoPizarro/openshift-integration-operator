#!/usr/bin/env node
/**
 * One-shot generator for v0.8.0 flow-catalog additions.
 * Run: node scripts/generate-v080-catalog.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CATALOG_PATH = path.join(ROOT, 'docs', 'flow-catalog.json');

function timerLog(id, componentStep, message) {
  const steps = componentStep
    ? [componentStep, { log: { message } }]
    : [{ setBody: { constant: 'Demo payload' } }, { log: { message } }];
  const yamlSteps = steps.map(s => {
    if (s.log) return `        - log:\n            message: "${s.log.message}"`;
    if (s.setBody) return `        - setBody:\n            constant: "${s.setBody.constant}"`;
    if (s.to) {
      const params = s.to.parameters
        ? '\n            parameters:\n' + Object.entries(s.to.parameters).map(([k, v]) => `              ${k}: "${v}"`).join('\n')
        : '';
      return `        - to:\n            uri: "${s.to.uri}"${params}`;
    }
    return '';
  }).join('\n');
  return `- route:\n    id: ${id}\n    from:\n      uri: "timer:${id}"\n      parameters:\n        period: "60000"\n      steps:\n${yamlSteps}`;
}

function httpWebhook(id, pathSeg, logMsg) {
  return `- route:\n    id: ${id}\n    from:\n      uri: "platform-http:${pathSeg}"\n      parameters:\n        httpMethodRestrict: POST\n      steps:\n        - log:\n            message: "${logMsg}: \${body}"`;
}

function flow(def) {
  return {
    name: def.name,
    type: 'CAMEL_ROUTE',
    components: def.components,
    description: def.description,
    pattern: def.pattern || 'Ephemeral SaaS Demo',
    authType: def.authType,
    requiredSecrets: def.requiredSecrets,
    suggestedProperties: def.suggestedProperties,
    credentialHints: def.credentialHints,
    kaotoDesign: def.kaotoDesign,
  };
}

const NEW_CATEGORIES = [
  {
    id: 'saas-messaging',
    icon: '💬',
    title: 'Messaging & Chat',
    flows: [
      flow({
        name: 'slack-notify-ephemeral',
        components: 'timer, slack, log',
        description: 'Timer-driven Slack notification via Incoming Webhook',
        pattern: 'Scheduled Notification',
        authType: 'static_token_webhook',
        requiredSecrets: ['SLACK_WEBHOOK_URL'],
        suggestedProperties: { 'camel.component.slack.webhook-url': '${SLACK_WEBHOOK_URL}' },
        credentialHints: 'Slack app → Incoming Webhooks → copy webhook URL into Secret',
        kaotoDesign: timerLog('slack-notify-ephemeral', {
          to: { uri: 'slack:#alerts', parameters: { webhookUrl: '{{slack.webhook.url}}' } },
        }, 'Slack notification sent'),
      }),
      flow({
        name: 'telegram-bot-notify',
        components: 'timer, telegram, log',
        description: 'Send a demo message via Telegram Bot API',
        pattern: 'Bot Notification',
        authType: 'static_token_webhook',
        requiredSecrets: ['TELEGRAM_BOT_TOKEN'],
        suggestedProperties: {
          'camel.component.telegram.authorization-token': '${TELEGRAM_BOT_TOKEN}',
        },
        credentialHints: 'Create bot via @BotFather; store bot token in Secret',
        kaotoDesign: timerLog('telegram-bot-notify', {
          to: { uri: 'telegram:demo-chat' },
        }, 'Telegram message sent'),
      }),
      flow({
        name: 'discord-webhook',
        components: 'timer, https, log',
        description: 'Post a message to Discord via channel webhook URL',
        pattern: 'Webhook Notification',
        authType: 'static_token_webhook',
        requiredSecrets: ['DISCORD_WEBHOOK_URL'],
        suggestedProperties: {},
        credentialHints: 'Discord channel → Integrations → Webhooks → copy URL',
        kaotoDesign: timerLog('discord-webhook', {
          to: { uri: 'https:discord-webhook' },
        }, 'Discord webhook posted'),
      }),
      flow({
        name: 'twilio-sms-alert',
        components: 'timer, twilio, log',
        description: 'Send SMS alert via Twilio on a timer tick',
        pattern: 'SMS Alert',
        authType: 'api_key',
        requiredSecrets: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'],
        suggestedProperties: {
          'camel.component.twilio.account-sid': '${TWILIO_ACCOUNT_SID}',
          'camel.component.twilio.auth-token': '${TWILIO_AUTH_TOKEN}',
        },
        credentialHints: 'Twilio Console → Account SID + Auth Token',
        kaotoDesign: timerLog('twilio-sms-alert', {
          to: { uri: 'twilio:+15551234567' },
        }, 'Twilio SMS sent'),
      }),
      flow({
        name: 'gmail-imap-poll',
        components: 'timer, imap, log',
        description: 'Poll Gmail inbox via IMAP and log new unseen messages',
        pattern: 'Mail Poll',
        authType: 'oauth2_refresh',
        requiredSecrets: ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN'],
        suggestedProperties: {
          'camel.component.imap.host': 'imap.gmail.com',
          'camel.component.imap.username': '${GMAIL_USERNAME}',
        },
        credentialHints: 'Google Cloud OAuth app with Gmail scope; store refresh token',
        kaotoDesign: timerLog('gmail-imap-poll', {
          to: { uri: 'imap:inbox?unseen=true' },
        }, 'Gmail poll: ${header.Subject}'),
      }),
      flow({
        name: 'office365-mail-sync',
        components: 'timer, imap, log',
        description: 'Poll Office365 mailbox via IMAP and log subjects',
        pattern: 'Mail Sync',
        authType: 'oauth2_refresh',
        requiredSecrets: ['OFFICE365_CLIENT_ID', 'OFFICE365_CLIENT_SECRET', 'OFFICE365_REFRESH_TOKEN'],
        suggestedProperties: {
          'camel.component.imap.host': 'outlook.office365.com',
          'camel.component.imap.username': '${OFFICE365_USERNAME}',
        },
        credentialHints: 'Azure AD app with IMAP/SMTP OAuth; store refresh token',
        kaotoDesign: timerLog('office365-mail-sync', {
          to: { uri: 'imap:office365-inbox?unseen=true' },
        }, 'Office365 mail: ${header.Subject}'),
      }),
      flow({
        name: 'teams-channel-post',
        components: 'timer, https, log',
        description: 'Post adaptive card payload to Microsoft Teams incoming webhook',
        pattern: 'Teams Notification',
        authType: 'static_token_webhook',
        requiredSecrets: ['TEAMS_WEBHOOK_URL'],
        suggestedProperties: {},
        credentialHints: 'Teams channel → Connectors → Incoming Webhook URL',
        kaotoDesign: timerLog('teams-channel-post', {
          to: { uri: 'https:teams-webhook' },
        }, 'Teams channel post sent'),
      }),
      flow({
        name: 'whatsapp-send-message',
        components: 'timer, https, log',
        description: 'Send WhatsApp Business Cloud API text message',
        pattern: 'WhatsApp Outbound',
        authType: 'static_token_webhook',
        requiredSecrets: ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'],
        suggestedProperties: {},
        credentialHints: 'Meta Developer → WhatsApp Business → permanent access token + phone number ID',
        kaotoDesign: timerLog('whatsapp-send-message', {
          to: { uri: 'https:graph.facebook.com/v18.0/messages' },
        }, 'WhatsApp message sent'),
      }),
      flow({
        name: 'instagram-graph-post',
        components: 'timer, https, log',
        description: 'Publish media caption via Instagram Graph API',
        pattern: 'Social Publish',
        authType: 'oauth2_refresh',
        requiredSecrets: ['INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_BUSINESS_ACCOUNT_ID'],
        suggestedProperties: {},
        credentialHints: 'Meta Business → Instagram Graph API long-lived token + business account ID',
        kaotoDesign: timerLog('instagram-graph-post', {
          to: { uri: 'https:graph.facebook.com/v18.0/media' },
        }, 'Instagram post published'),
      }),
      flow({
        name: 'linkedin-share-post',
        components: 'timer, https, log',
        description: 'Share text update via LinkedIn Marketing API',
        pattern: 'Social Share',
        authType: 'oauth2_refresh',
        requiredSecrets: ['LINKEDIN_ACCESS_TOKEN'],
        suggestedProperties: {},
        credentialHints: 'LinkedIn Developer app → OAuth access token with w_member_social scope',
        kaotoDesign: timerLog('linkedin-share-post', {
          to: { uri: 'https:api.linkedin.com/v2/ugcPosts' },
        }, 'LinkedIn share posted'),
      }),
    ],
  },
  {
    id: 'crm-support',
    icon: '🎯',
    title: 'CRM & Support',
    flows: [
      flow({
        name: 'salesforce-lead-sync',
        components: 'timer, salesforce, log',
        description: 'Poll Salesforce for new leads and log Lead Id',
        pattern: 'CRM Sync',
        authType: 'oauth2_refresh',
        requiredSecrets: ['SALESFORCE_CLIENT_ID', 'SALESFORCE_CLIENT_SECRET', 'SALESFORCE_REFRESH_TOKEN'],
        suggestedProperties: {
          'camel.component.salesforce.login-url': '${SALESFORCE_LOGIN_URL:https://login.salesforce.com}',
          'camel.component.salesforce.client-id': '${SALESFORCE_CLIENT_ID}',
          'camel.component.salesforce.client-secret': '${SALESFORCE_CLIENT_SECRET}',
        },
        credentialHints: 'Salesforce Connected App → OAuth refresh token in Secret',
        kaotoDesign: timerLog('salesforce-lead-sync', {
          to: { uri: 'salesforce:query?sObjectName=Lead' },
        }, 'Salesforce lead synced'),
      }),
      flow({
        name: 'hubspot-contact-webhook',
        components: 'platform-http, https, log',
        description: 'Receive HubSpot contact webhook and log contact id',
        pattern: 'CRM Webhook',
        authType: 'api_key',
        requiredSecrets: ['HUBSPOT_API_KEY'],
        suggestedProperties: {},
        credentialHints: 'HubSpot Private App → access token as HUBSPOT_API_KEY',
        kaotoDesign: httpWebhook('hubspot-contact-webhook', '/webhook/hubspot/contact', 'HubSpot contact event'),
      }),
      flow({
        name: 'zendesk-ticket-create',
        components: 'timer, https, log',
        description: 'Create Zendesk support ticket via REST API',
        pattern: 'Ticket Create',
        authType: 'basic_auth',
        requiredSecrets: ['ZENDESK_SUBDOMAIN', 'ZENDESK_EMAIL', 'ZENDESK_API_TOKEN'],
        suggestedProperties: {},
        credentialHints: 'Zendesk Admin → API token; use email/token as basic auth',
        kaotoDesign: timerLog('zendesk-ticket-create', {
          to: { uri: 'https:zendesk-api/tickets.json' },
        }, 'Zendesk ticket created'),
      }),
      flow({
        name: 'freshdesk-ticket-sync',
        components: 'timer, https, log',
        description: 'Sync Freshdesk tickets on a schedule',
        pattern: 'Ticket Sync',
        authType: 'basic_auth',
        requiredSecrets: ['FRESHDESK_DOMAIN', 'FRESHDESK_API_KEY'],
        suggestedProperties: {},
        credentialHints: 'Freshdesk Profile → API key as basic auth password',
        kaotoDesign: timerLog('freshdesk-ticket-sync', {
          to: { uri: 'https:freshdesk-api/tickets' },
        }, 'Freshdesk tickets synced'),
      }),
    ],
  },
  {
    id: 'productivity',
    icon: '📋',
    title: 'Productivity & Workspace',
    flows: [
      flow({
        name: 'google-sheets-row-trigger',
        components: 'timer, google-sheets, log',
        description: 'Poll Google Sheet for new rows and log row data',
        pattern: 'Sheet Trigger',
        authType: 'oauth2_refresh',
        requiredSecrets: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'],
        suggestedProperties: {
          'camel.component.google-sheets.application-name': 'integration-operator',
        },
        credentialHints: 'Google Cloud OAuth app with Sheets scope; refresh token in Secret',
        kaotoDesign: timerLog('google-sheets-row-trigger', {
          to: { uri: 'google-sheets:spreadsheetId' },
        }, 'New sheet row: ${body}'),
      }),
      flow({
        name: 'google-drive-upload',
        components: 'timer, google-drive, log',
        description: 'Upload demo file metadata to Google Drive folder',
        pattern: 'Drive Upload',
        authType: 'oauth2_refresh',
        requiredSecrets: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'],
        suggestedProperties: {
          'camel.component.google-drive.application-name': 'integration-operator',
        },
        credentialHints: 'Google Cloud OAuth app with Drive scope',
        kaotoDesign: timerLog('google-drive-upload', {
          to: { uri: 'google-drive:folderId' },
        }, 'Google Drive upload complete'),
      }),
      flow({
        name: 'google-calendar-event',
        components: 'timer, google-calendar, log',
        description: 'List upcoming Google Calendar events and log titles',
        pattern: 'Calendar Poll',
        authType: 'oauth2_refresh',
        requiredSecrets: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'],
        suggestedProperties: {
          'camel.component.google-calendar.application-name': 'integration-operator',
        },
        credentialHints: 'Google Cloud OAuth app with Calendar scope',
        kaotoDesign: timerLog('google-calendar-event', {
          to: { uri: 'google-calendar:primary/events' },
        }, 'Calendar event: ${body}'),
      }),
      flow({
        name: 'notion-page-create',
        components: 'timer, https, log',
        description: 'Create Notion page via REST API',
        pattern: 'Page Create',
        authType: 'api_key',
        requiredSecrets: ['NOTION_API_KEY', 'NOTION_DATABASE_ID'],
        suggestedProperties: {},
        credentialHints: 'Notion Integrations → Internal integration secret token',
        kaotoDesign: timerLog('notion-page-create', {
          to: { uri: 'https:api.notion.com/v1/pages' },
        }, 'Notion page created'),
      }),
      flow({
        name: 'trello-card-create',
        components: 'timer, https, log',
        description: 'Create Trello card on a list via REST API',
        pattern: 'Card Create',
        authType: 'api_key',
        requiredSecrets: ['TRELLO_API_KEY', 'TRELLO_TOKEN', 'TRELLO_LIST_ID'],
        suggestedProperties: {},
        credentialHints: 'Trello Power-Up → API key + user token',
        kaotoDesign: timerLog('trello-card-create', {
          to: { uri: 'https:api.trello.com/1/cards' },
        }, 'Trello card created'),
      }),
      flow({
        name: 'asana-task-create',
        components: 'timer, https, log',
        description: 'Create Asana task in a project',
        pattern: 'Task Create',
        authType: 'api_key',
        requiredSecrets: ['ASANA_ACCESS_TOKEN', 'ASANA_PROJECT_ID'],
        suggestedProperties: {},
        credentialHints: 'Asana Developer Console → Personal Access Token',
        kaotoDesign: timerLog('asana-task-create', {
          to: { uri: 'https:app.asana.com/api/1.0/tasks' },
        }, 'Asana task created'),
      }),
      flow({
        name: 'monday-item-update',
        components: 'timer, https, log',
        description: 'Update Monday.com board item column value',
        pattern: 'Board Update',
        authType: 'api_key',
        requiredSecrets: ['MONDAY_API_TOKEN', 'MONDAY_BOARD_ID'],
        suggestedProperties: {},
        credentialHints: 'Monday Developer → API token v2',
        kaotoDesign: timerLog('monday-item-update', {
          to: { uri: 'https:api.monday.com/v2' },
        }, 'Monday item updated'),
      }),
    ],
  },
  {
    id: 'devops',
    icon: '🔧',
    title: 'DevOps & ITSM',
    flows: [
      flow({
        name: 'gitlab-pipeline-trigger',
        components: 'timer, https, log',
        description: 'Trigger GitLab CI pipeline via pipeline trigger token',
        pattern: 'CI Trigger',
        authType: 'api_key',
        requiredSecrets: ['GITLAB_TOKEN', 'GITLAB_PROJECT_ID'],
        suggestedProperties: {},
        credentialHints: 'GitLab Project → CI/CD → Pipeline triggers token',
        kaotoDesign: timerLog('gitlab-pipeline-trigger', {
          to: { uri: 'https:gitlab.com/api/v4/projects/trigger/pipeline' },
        }, 'GitLab pipeline triggered'),
      }),
      flow({
        name: 'confluence-page-update',
        components: 'timer, https, log',
        description: 'Update Confluence page body via REST API',
        pattern: 'Wiki Update',
        authType: 'basic_auth',
        requiredSecrets: ['CONFLUENCE_BASE_URL', 'CONFLUENCE_EMAIL', 'CONFLUENCE_API_TOKEN'],
        suggestedProperties: {},
        credentialHints: 'Atlassian API token + site URL for basic auth',
        kaotoDesign: timerLog('confluence-page-update', {
          to: { uri: 'https:confluence-api/rest/api/content' },
        }, 'Confluence page updated'),
      }),
      flow({
        name: 'pagerduty-incident',
        components: 'timer, https, log',
        description: 'Create PagerDuty incident via Events API v2',
        pattern: 'Incident Create',
        authType: 'api_key',
        requiredSecrets: ['PAGERDUTY_ROUTING_KEY'],
        suggestedProperties: {},
        credentialHints: 'PagerDuty Service → Integrations → Events API v2 routing key',
        kaotoDesign: timerLog('pagerduty-incident', {
          to: { uri: 'https:events.pagerduty.com/v2/enqueue' },
        }, 'PagerDuty incident created'),
      }),
      flow({
        name: 'opsgenie-alert',
        components: 'timer, https, log',
        description: 'Raise Opsgenie alert via REST API',
        pattern: 'Alert Create',
        authType: 'api_key',
        requiredSecrets: ['OPSGENIE_API_KEY'],
        suggestedProperties: {},
        credentialHints: 'Opsgenie Settings → API key management',
        kaotoDesign: timerLog('opsgenie-alert', {
          to: { uri: 'https:api.opsgenie.com/v2/alerts' },
        }, 'Opsgenie alert raised'),
      }),
    ],
  },
  {
    id: 'commerce-latam',
    icon: '🛒',
    title: 'E-commerce & Payments (LatAm)',
    flows: [
      flow({
        name: 'mercadolibre-order-webhook',
        components: 'platform-http, https, log',
        description: 'Receive Mercado Libre order notification webhook',
        pattern: 'Order Webhook',
        authType: 'oauth2_refresh',
        requiredSecrets: ['ML_CLIENT_ID', 'ML_CLIENT_SECRET', 'ML_ACCESS_TOKEN'],
        suggestedProperties: {},
        credentialHints: 'Mercado Libre Developers → OAuth app + user access token',
        kaotoDesign: httpWebhook('mercadolibre-order-webhook', '/webhook/mercadolibre/orders', 'ML order'),
      }),
      flow({
        name: 'mercadopago-payment-notify',
        components: 'platform-http, https, log',
        description: 'Receive Mercado Pago payment IPN webhook',
        pattern: 'Payment Webhook',
        authType: 'api_key',
        requiredSecrets: ['MERCADOPAGO_ACCESS_TOKEN'],
        suggestedProperties: {},
        credentialHints: 'Mercado Pago Developers → production access token',
        kaotoDesign: httpWebhook('mercadopago-payment-notify', '/webhook/mercadopago/payments', 'Mercado Pago payment'),
      }),
      flow({
        name: 'shopify-order-sync',
        components: 'timer, https, log',
        description: 'Poll Shopify orders REST API and log order name',
        pattern: 'Order Sync',
        authType: 'api_key',
        requiredSecrets: ['SHOPIFY_ACCESS_TOKEN', 'SHOPIFY_SHOP_DOMAIN'],
        suggestedProperties: {},
        credentialHints: 'Shopify Admin → Custom app → Admin API access token',
        kaotoDesign: timerLog('shopify-order-sync', {
          to: { uri: 'https:shopify-admin/orders.json' },
        }, 'Shopify order synced'),
      }),
      flow({
        name: 'woocommerce-order-hook',
        components: 'platform-http, https, log',
        description: 'Receive WooCommerce order webhook and log order id',
        pattern: 'Order Webhook',
        authType: 'basic_auth',
        requiredSecrets: ['WOOCOMMERCE_CONSUMER_KEY', 'WOOCOMMERCE_CONSUMER_SECRET'],
        suggestedProperties: {},
        credentialHints: 'WooCommerce → Settings → Advanced → REST API keys',
        kaotoDesign: httpWebhook('woocommerce-order-hook', '/webhook/woocommerce/order', 'WooCommerce order'),
      }),
    ],
  },
  {
    id: 'ai-mcp',
    icon: '🧠',
    title: 'AI / LLM & MCP',
    flows: [
      flow({
        name: 'openai-chat-ephemeral',
        components: 'timer, langchain4j-chat, log',
        description: 'Timer-driven OpenAI chat completion via langchain4j',
        pattern: 'LLM Chat',
        authType: 'api_key',
        requiredSecrets: ['OPENAI_API_KEY'],
        suggestedProperties: {
          'quarkus.langchain4j.openai.api-key': '${OPENAI_API_KEY}',
          'quarkus.langchain4j.openai.chat-model.model-name': '${OPENAI_MODEL:gpt-4o-mini}',
        },
        credentialHints: 'OpenAI platform → API key in Secret',
        kaotoDesign: timerLog('openai-chat-ephemeral', {
          to: { uri: 'langchain4j-chat:openai' },
        }, 'OpenAI response: ${body}'),
      }),
      flow({
        name: 'azure-openai-chat',
        components: 'timer, langchain4j-chat, log',
        description: 'Azure OpenAI chat via langchain4j with custom base-url',
        pattern: 'Azure LLM',
        authType: 'api_key',
        requiredSecrets: ['AZURE_OPENAI_API_KEY', 'AZURE_OPENAI_ENDPOINT'],
        suggestedProperties: {
          'quarkus.langchain4j.openai.api-key': '${AZURE_OPENAI_API_KEY}',
          'quarkus.langchain4j.openai.base-url': '${AZURE_OPENAI_ENDPOINT}',
          'quarkus.langchain4j.openai.chat-model.model-name': '${AZURE_OPENAI_DEPLOYMENT:gpt-4o}',
        },
        credentialHints: 'Azure OpenAI resource → endpoint + deployment + API key',
        kaotoDesign: timerLog('azure-openai-chat', {
          to: { uri: 'langchain4j-chat:azure' },
        }, 'Azure OpenAI response: ${body}'),
      }),
      flow({
        name: 'anthropic-claude-chat',
        components: 'timer, langchain4j-chat, log',
        description: 'Anthropic Claude chat via langchain4j (OpenAI-compatible proxy or direct)',
        pattern: 'Claude Chat',
        authType: 'api_key',
        requiredSecrets: ['ANTHROPIC_API_KEY'],
        suggestedProperties: {
          'quarkus.langchain4j.anthropic.api-key': '${ANTHROPIC_API_KEY}',
          'quarkus.langchain4j.anthropic.chat-model.model-name': '${ANTHROPIC_MODEL:claude-3-5-sonnet-20241022}',
        },
        credentialHints: 'Anthropic Console → API key',
        kaotoDesign: timerLog('anthropic-claude-chat', {
          to: { uri: 'langchain4j-chat:claude' },
        }, 'Claude response: ${body}'),
      }),
      flow({
        name: 'messaging-llm-mcp-auto-reply',
        components: 'platform-http, slack, langchain4j-chat, https, log',
        description: 'Flagship v0.8.0: inbound message → LLM → MCP tool → auto-reply to channel',
        pattern: 'Messaging + LLM + MCP',
        authType: 'api_key',
        requiredSecrets: ['OPENAI_API_KEY', 'SLACK_WEBHOOK_URL', 'MCP_SERVER_URL', 'OPERATOR_MCP_TOKEN'],
        suggestedProperties: {
          'quarkus.langchain4j.openai.api-key': '${OPENAI_API_KEY}',
          'quarkus.langchain4j.openai.chat-model.model-name': 'gpt-4o-mini',
          'camel.component.slack.webhook-url': '${SLACK_WEBHOOK_URL}',
          'mcp.server.url': '${MCP_SERVER_URL}',
        },
        credentialHints: 'OpenAI key + Slack webhook + operator MCP bridge token; flagship demo for v0.8.0',
        kaotoDesign: `- route:\n    id: messaging-llm-mcp-auto-reply\n    from:\n      uri: "platform-http:/webhook/inbound-message"\n      parameters:\n        httpMethodRestrict: POST\n      steps:\n        - setProperty:\n            name: userMessage\n            simple: "\${body}"\n        - setBody:\n            simple: "Classify intent and draft a helpful reply for: \${exchangeProperty.userMessage}"\n        - to:\n            uri: "langchain4j-chat:reply-model"\n        - setProperty:\n            name: draftReply\n            simple: "\${body}"\n        - setHeader:\n            name: CamelHttpMethod\n            constant: POST\n        - setHeader:\n            name: Authorization\n            simple: "Bearer \${env:OPERATOR_MCP_TOKEN}"\n        - setBody:\n            simple: '{"query":"\${exchangeProperty.userMessage}"}'\n        - to:\n            uri: "https:operator-mcp/tools/web_search/call"\n        - setProperty:\n            name: mcpContext\n            simple: "\${body}"\n        - setBody:\n            simple: "Reply to user using context. User: \${exchangeProperty.userMessage} Draft: \${exchangeProperty.draftReply} Context: \${exchangeProperty.mcpContext}"\n        - to:\n            uri: "langchain4j-chat:final-reply"\n        - to:\n            uri: "slack:#auto-reply"\n            parameters:\n              webhookUrl: "{{slack.webhook.url}}"\n        - log:\n            message: "Auto-reply sent: \${body}"`,
      }),
    ],
  },
  {
    id: 'identity-secrets',
    icon: '🔐',
    title: 'Identity & Secrets',
    flows: [
      flow({
        name: 'vault-secret-rotation',
        components: 'timer, hashicorp-vault, log',
        description: 'Read secret from Vault KV and log rotation timestamp',
        pattern: 'Secret Rotation',
        authType: 'api_key',
        requiredSecrets: ['VAULT_ADDR', 'VAULT_TOKEN'],
        suggestedProperties: {
          'camel.component.hashicorp-vault.host': '${VAULT_ADDR:http://localhost:8200}',
          'camel.component.hashicorp-vault.token': '${VAULT_TOKEN}',
        },
        credentialHints: 'Vault policy token with read on secret/data path',
        kaotoDesign: timerLog('vault-secret-rotation', {
          to: { uri: 'hashicorp-vault:secret/data/demo' },
        }, 'Vault secret read at ${date:now:yyyy-MM-dd HH:mm:ss}'),
      }),
      flow({
        name: 'okta-user-provision',
        components: 'timer, https, log',
        description: 'Provision demo user via Okta SCIM/Admin API',
        pattern: 'User Provision',
        authType: 'oauth2_refresh',
        requiredSecrets: ['OKTA_DOMAIN', 'OKTA_API_TOKEN'],
        suggestedProperties: {},
        credentialHints: 'Okta Admin → API token or OAuth service app',
        kaotoDesign: timerLog('okta-user-provision', {
          to: { uri: 'https:okta-api/api/v1/users' },
        }, 'Okta user provisioned'),
      }),
      flow({
        name: 'azure-ad-group-sync',
        components: 'timer, https, log',
        description: 'Sync Azure AD group members via Microsoft Graph',
        pattern: 'Group Sync',
        authType: 'oauth2_refresh',
        requiredSecrets: ['AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET'],
        suggestedProperties: {},
        credentialHints: 'Azure AD app registration → client credentials or delegated token',
        kaotoDesign: timerLog('azure-ad-group-sync', {
          to: { uri: 'https:graph.microsoft.com/v1.0/groups' },
        }, 'Azure AD group synced'),
      }),
    ],
  },
];

const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));

// Update stripe-payment-notify in enterprise
const enterprise = catalog.find(c => c.id === 'enterprise');
if (enterprise) {
  const stripe = enterprise.flows.find(f => f.name === 'stripe-payment-notify');
  if (stripe) {
    stripe.authType = 'api_key';
    stripe.requiredSecrets = ['STRIPE_WEBHOOK_SECRET', 'SLACK_WEBHOOK_URL'];
    stripe.suggestedProperties = {
      'stripe.webhook.secret': '${STRIPE_WEBHOOK_SECRET}',
      'camel.component.slack.webhook-url': '${SLACK_WEBHOOK_URL}',
    };
    stripe.credentialHints = 'Stripe Dashboard → Webhooks signing secret; Slack Incoming Webhook for payment alerts';
  }
}

// Append new categories (skip if already present)
const existingIds = new Set(catalog.map(c => c.id));
let added = 0;
for (const cat of NEW_CATEGORIES) {
  if (existingIds.has(cat.id)) {
    console.log(`[SKIP] category ${cat.id} already exists`);
    continue;
  }
  catalog.push(cat);
  added += cat.flows.length;
  console.log(`[ADD] ${cat.id}: ${cat.flows.length} flows`);
}

fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + '\n');
console.log(`\nDone. Added ${added} flows. Total categories: ${catalog.length}`);
let total = 0;
catalog.forEach(c => { total += c.flows.length; });
console.log(`Total flows: ${total}`);
