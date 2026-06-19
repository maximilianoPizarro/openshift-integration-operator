const fs = require('fs');
let file = fs.readFileSync('docs/ready-flows.html', 'utf8');

const upcomingHtml = `
  <div style="background-color: var(--pf-global--palette--blue-50, #e7f1fa); border-left: 4px solid var(--pf-global--palette--blue-400, #2b9af3); padding: 1rem; margin-bottom: 1.5rem; border-radius: 4px;">
    <h3 style="margin-top: 0; margin-bottom: 0.5rem; font-size: 1.1rem; color: var(--pf-global--palette--blue-700, #002952);">🚀 Upcoming Ready Flows</h3>
    <p style="margin: 0; font-size: 0.95rem;">
      <strong>Coming soon:</strong> Telegram, Salesforce, Mercado Libre/Mercado Pago, and extended OpenAI/Anthropic examples (highlighting the powerful combo with MCP and <code>camel-worker-ai</code>).
    </p>
  </div>
`;

const insertionPoint = file.indexOf('<div class="controls">');
if (insertionPoint !== -1) {
  file = file.slice(0, insertionPoint) + upcomingHtml + file.slice(insertionPoint);
  fs.writeFileSync('docs/ready-flows.html', file);
  console.log("Added to ready-flows.html");
} else {
  console.log("Could not find controls div");
}
