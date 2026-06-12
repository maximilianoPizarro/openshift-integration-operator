#!/usr/bin/env python3
"""Generate k8s/examples/ephemeral-ai/*.yaml — run once when adding new templates."""
from pathlib import Path

BASE = Path(__file__).resolve().parents[1] / "k8s" / "examples" / "ephemeral-ai"

COMMON_PROPS = {
    "basic": """    properties:
      # COMPLETAR: usa Secret openai-credentials (envFrom) o pega la key aquí
      quarkus.langchain4j.openai.api-key: "${OPENAI_API_KEY}"
      quarkus.langchain4j.openai.chat-model.model-name: "gpt-4o-mini"
      quarkus.langchain4j.openai.chat-model.temperature: "0.7"
      quarkus.langchain4j.openai.chat-model.max-completion-tokens: "1024\"""",
    "deterministic": """    properties:
      quarkus.langchain4j.openai.api-key: "${OPENAI_API_KEY}"
      quarkus.langchain4j.openai.chat-model.model-name: "gpt-4o-mini"
      quarkus.langchain4j.openai.chat-model.temperature: "0.0"
      quarkus.langchain4j.openai.chat-model.max-completion-tokens: "512\"""",
    "creative": """    properties:
      quarkus.langchain4j.openai.api-key: "${OPENAI_API_KEY}"
      quarkus.langchain4j.openai.chat-model.model-name: "gpt-4o-mini"
      quarkus.langchain4j.openai.chat-model.temperature: "0.9"
      quarkus.langchain4j.openai.chat-model.max-completion-tokens: "1024\"""",
    "long": """    properties:
      quarkus.langchain4j.openai.api-key: "${OPENAI_API_KEY}"
      quarkus.langchain4j.openai.chat-model.model-name: "gpt-4o-mini"
      quarkus.langchain4j.openai.chat-model.temperature: "0.3"
      quarkus.langchain4j.openai.chat-model.max-completion-tokens: "2048\"""",
}

HEADER = """# {title}
# Plain-text prompt in kaotoDesign — complete spec.ephemeral.properties before apply.
# See docs/ephemeral-ai-examples.txt for the full property cheat sheet.
#
# oc create secret generic openai-credentials -n openshift-integration \\
#   --from-literal=OPENAI_API_KEY=sk-proj-REPLACE_ME
apiVersion: platform.io/v1alpha1
kind: IntegrationFlow
metadata:
  name: {name}
  namespace: openshift-integration
spec:
  deploymentMode: EPHEMERAL
  integrationType: CAMEL_ROUTE
  engine: CAMEL
  ephemeral:
    ttlSeconds: 3600
{props}
  secrets:
    - name: openai-credentials
      envFrom: true
  targeting:
    strategy: explicit
    clusters: [local]
  kaotoDesign: |
"""

EXAMPLES = [
    ("01-openai-simple-chat.yaml", "ephemeral-ai-simple-chat", "Simple chat — timer asks one question",
     "basic", r"""    - route:
        id: ai-simple-chat
        from:
          uri: "timer:aiTick?period=90000"
          steps:
            - setBody:
                constant: "Explain Apache Camel integration platforms in one clear sentence."
            - to:
                uri: "langchain4j-chat:simple"
            - log:
                message: "AI response: ${body}"
"""),
    ("02-chain-of-thought.yaml", "ephemeral-ai-chain-of-thought", "Chain of thought — decompose then answer",
     "long", r"""    - route:
        id: ai-chain-of-thought
        from:
          uri: "timer:cotTick?period=120000"
          steps:
            - setProperty:
                name: question
                constant: "A farmer has 17 sheep. All but 9 die. How many are left?"
            - setBody:
                simple: "Break this into numbered reasoning steps only. Problem: ${exchangeProperty.question}"
            - to:
                uri: "langchain4j-chat:step1"
            - setProperty:
                name: steps
                simple: "${body}"
            - setBody:
                simple: "Reasoning steps:\n${exchangeProperty.steps}\n\nGive the final numeric answer only."
            - to:
                uri: "langchain4j-chat:step2"
            - log:
                message: "CoT answer: ${body}"
"""),
    ("03-sentiment-classifier.yaml", "ephemeral-ai-sentiment", "Sentiment → choice router",
     "deterministic", r"""    - route:
        id: ai-sentiment
        from:
          uri: "timer:sentimentTick?period=60000"
          steps:
            - setProperty:
                name: feedback
                constant: "Your app crashed twice today and I lost a customer order. This is unacceptable."
            - setBody:
                simple: "Classify sentiment as exactly one word: POSITIVE, NEGATIVE, NEUTRAL, or URGENT.\nFeedback: ${exchangeProperty.feedback}"
            - to:
                uri: "langchain4j-chat:classifier"
            - setProperty:
                name: sentiment
                simple: "${body.trim()}"
            - choice:
                when:
                  - simple: "${exchangeProperty.sentiment} == 'URGENT'"
                    steps:
                      - log:
                          message: "ROUTE urgent queue — sentiment=${exchangeProperty.sentiment}"
                  - simple: "${exchangeProperty.sentiment} == 'NEGATIVE'"
                    steps:
                      - log:
                          message: "ROUTE review queue — sentiment=${exchangeProperty.sentiment}"
                otherwise:
                  steps:
                    - log:
                        message: "ROUTE standard queue — sentiment=${exchangeProperty.sentiment}"
"""),
    ("04-translation.yaml", "ephemeral-ai-translation", "Spanish → English translation",
     "basic", r"""    - route:
        id: ai-translation
        from:
          uri: "timer:translateTick?period=75000"
          steps:
            - setProperty:
                name: sourceText
                constant: "El operador despliega flujos efímeros sin repositorio Git."
            - setBody:
                simple: "Translate to English. Return only the translation.\nText: ${exchangeProperty.sourceText}"
            - to:
                uri: "langchain4j-chat:translator"
            - log:
                message: "Translation: ${body}"
"""),
    ("05-structured-extraction.yaml", "ephemeral-ai-extraction", "Plain text → structured JSON",
     "deterministic", r"""    - route:
        id: ai-extraction
        from:
          uri: "timer:extractTick?period=90000"
          steps:
            - setBody:
                constant: |
                  Meeting notes: Alice (PM) will send the budget by Friday. Bob from DevOps confirmed the cluster upgrade on March 12. Action: Carol to review the integration test plan.
            - setBody:
                simple: "${body}\n\nExtract JSON with fields persons(name,role), dates(event,date), action_items(array of strings). Return valid JSON only."
            - to:
                uri: "langchain4j-chat:extractor"
            - log:
                message: "Extracted JSON: ${body}"
"""),
    ("06-document-summary.yaml", "ephemeral-ai-summary", "Long text → bullet summary",
     "long", r"""    - route:
        id: ai-summary
        from:
          uri: "timer:summaryTick?period=120000"
          steps:
            - setBody:
                constant: |
                  Quarterly report: Integration adoption grew 40%. Ephemeral Quick Try reduced eval time from days to minutes. Top requests: multicluster GitOps, offline catalog, and AI-assisted route design. Risks: worker image size and LLM credential management. Next quarter focus: Fuse migration guides and OperatorHub listing.
            - setBody:
                simple: "Summarize in 3 bullet points (key finding, risk, next step):\n${body}"
            - to:
                uri: "langchain4j-chat:summarizer"
            - log:
                message: "Summary:\n${body}"
"""),
    ("07-code-review.yaml", "ephemeral-ai-code-review", "Diff review → JSON findings",
     "basic", r"""    - route:
        id: ai-code-review
        from:
          uri: "timer:reviewTick?period=120000"
          steps:
            - setBody:
                constant: |
                  --- a/OrderService.java
                  +++ b/OrderService.java
                  @@ -10,7 +10,7 @@
                   public void save(Order o) {
                  -    jdbc.update("INSERT INTO orders VALUES (" + o.getId() + "," + o.getTotal() + ")");
                  +    jdbc.update("INSERT INTO orders VALUES (?,?)", o.getId(), o.getTotal());
                   }
            - setBody:
                simple: "${body}\n\nReturn a JSON array of objects with line, severity(INFO/WARNING/ERROR), issue, suggestion."
            - to:
                uri: "langchain4j-chat:reviewer"
            - log:
                message: "Code review: ${body}"
"""),
    ("08-intent-dispatcher.yaml", "ephemeral-ai-intent", "Intent label → direct handler",
     "deterministic", r"""    - route:
        id: ai-intent-main
        from:
          uri: "timer:intentTick?period=60000"
          steps:
            - setProperty:
                name: userMessage
                constant: "I need a refund for order 8842, it arrived damaged."
            - setBody:
                simple: "Classify intent as one label only: ORDER_STATUS, REFUND_REQUEST, PRODUCT_INQUIRY, COMPLAINT, GENERAL_QUESTION.\nMessage: ${exchangeProperty.userMessage}"
            - to:
                uri: "langchain4j-chat:intent"
            - setProperty:
                name: intent
                simple: "${body.trim()}"
            - choice:
                when:
                  - simple: "${exchangeProperty.intent} == 'REFUND_REQUEST'"
                    steps:
                      - to:
                          uri: "direct:refund-handler"
                otherwise:
                  steps:
                    - to:
                        uri: "direct:general-handler"
    - route:
        id: refund-handler
        from:
          uri: "direct:refund-handler"
          steps:
            - log:
                message: "Dispatch REFUND workflow for: ${exchangeProperty.userMessage}"
    - route:
        id: general-handler
        from:
          uri: "direct:general-handler"
          steps:
            - log:
                message: "Dispatch GENERAL handler (intent=${exchangeProperty.intent})"
"""),
    ("09-content-moderation.yaml", "ephemeral-ai-moderation", "UGC moderation JSON",
     "basic", r"""    - route:
        id: ai-moderation
        from:
          uri: "timer:moderationTick?period=90000"
          steps:
            - setProperty:
                name: content
                constant: "Buy cheap pills now!!! Click here http://spam.example"
            - setBody:
                simple: "Moderate this user content. Return JSON: approved(boolean), flags(array), confidence(0-1), explanation(string).\nContent: ${exchangeProperty.content}"
            - to:
                uri: "langchain4j-chat:moderator"
            - log:
                message: "Moderation result: ${body}"
"""),
    ("10-error-triage.yaml", "ephemeral-ai-error-triage", "Stack trace → triage JSON",
     "deterministic", r"""    - route:
        id: ai-error-triage
        from:
          uri: "timer:errorTick?period=90000"
          steps:
            - setBody:
                constant: |
                  org.postgresql.util.PSQLException: Connection refused: localhost:5432
                  at com.example.OrderRepo.findAll(OrderRepo.java:42)
                  Caused by: java.net.ConnectException: Connection refused
            - setBody:
                simple: "Classify this error. Return JSON only: category, severity(LOW|MEDIUM|HIGH|CRITICAL), rootCause(one line).\nError:\n${body}"
            - to:
                uri: "langchain4j-chat:triage"
            - log:
                message: "Triage: ${body}"
"""),
    ("11-inline-rag.yaml", "ephemeral-ai-inline-rag", "Context block + question (no vector DB)",
     "basic", r"""    - route:
        id: ai-inline-rag
        from:
          uri: "timer:ragTick?period=120000"
          steps:
            - setProperty:
                name: context
                constant: |
                  Product docs: Ephemeral mode deploys IntegrationFlow workers without Git. TTL defaults to 3600s. Delete the CR to cleanup. Promote-to-GitOps scaffolds a repo.
            - setProperty:
                name: question
                constant: "How do I clean up ephemeral resources?"
            - setBody:
                simple: "Use ONLY this context:\n${exchangeProperty.context}\n\nQuestion: ${exchangeProperty.question}\nAnswer in one paragraph."
            - to:
                uri: "langchain4j-chat:rag"
            - log:
                message: "RAG answer: ${body}"
"""),
    ("12-temperature-compare.yaml", "ephemeral-ai-temp-compare", "Same prompt, low vs high temperature",
     "basic", r"""    - route:
        id: ai-temp-compare
        from:
          uri: "timer:tempTick?period=120000"
          steps:
            - setProperty:
                name: prompt
                constant: "Describe a futuristic integration platform in exactly 15 words."
            - setBody:
                simple: "${exchangeProperty.prompt}"
            - setHeader:
                name: CamelLangChain4jChatTemperature
                constant: "0.1"
            - to:
                uri: "langchain4j-chat:low-temp"
            - setProperty:
                name: lowTemp
                simple: "${body}"
            - setBody:
                simple: "${exchangeProperty.prompt}"
            - setHeader:
                name: CamelLangChain4jChatTemperature
                constant: "1.0"
            - to:
                uri: "langchain4j-chat:high-temp"
            - log:
                message: "temp=0.1 → ${exchangeProperty.lowTemp} | temp=1.0 → ${body}"
"""),
    ("13-email-triage.yaml", "ephemeral-ai-email-triage", "Email subject+body → category",
     "deterministic", r"""    - route:
        id: ai-email-triage
        from:
          uri: "timer:emailTick?period=90000"
          steps:
            - setProperty:
                name: subject
                constant: "Invoice #9921 payment failed"
            - setProperty:
                name: body
                constant: "Our credit card was declined when renewing the OpenShift subscription."
            - setBody:
                simple: "Classify this email into ONE category: BILLING, TECHNICAL, GENERAL, URGENT.\nSubject: ${exchangeProperty.subject}\nBody: ${exchangeProperty.body}\nRespond with the category only."
            - to:
                uri: "langchain4j-chat:email-triage"
            - log:
                message: "Email category: ${body}"
"""),
    ("14-json-repair.yaml", "ephemeral-ai-json-repair", "Malformed JSON → valid JSON",
     "deterministic", r"""    - route:
        id: ai-json-repair
        from:
          uri: "timer:jsonTick?period=90000"
          steps:
            - setBody:
                constant: '{name: "integration-flow", phase: Running, clusters: [local,]'
            - setBody:
                simple: "Fix this malformed JSON. Return valid JSON only, no markdown:\n${body}"
            - to:
                uri: "langchain4j-chat:json-fix"
            - log:
                message: "Repaired JSON: ${body}"
"""),
    ("15-product-description.yaml", "ephemeral-ai-product-desc", "Features → marketing copy",
     "creative", r"""    - route:
        id: ai-product-desc
        from:
          uri: "timer:productTick?period=120000"
          steps:
            - setBody:
                constant: |
                  Features: visual Camel designer, ephemeral Quick Try, GitOps with Tekton+Argo CD, multicluster ApplicationSets, live flow logs in console.
            - setBody:
                simple: "Write a 2-sentence marketing paragraph for these product features:\n${body}"
            - to:
                uri: "langchain4j-chat:marketer"
            - log:
                message: "Marketing copy: ${body}"
"""),
    ("16-meeting-actions.yaml", "ephemeral-ai-meeting-actions", "Transcript → action items",
     "basic", r"""    - route:
        id: ai-meeting-actions
        from:
          uri: "timer:meetingTick?period=90000"
          steps:
            - setBody:
                constant: |
                  Transcript: Team agreed to ship v0.5.0 docs this week. Maria owns the migration guide. Dev will publish Quay images before Friday demo.
            - setBody:
                simple: "List numbered action items with owner if mentioned:\n${body}"
            - to:
                uri: "langchain4j-chat:actions"
            - log:
                message: "Action items:\n${body}"
"""),
    ("17-log-explainer.yaml", "ephemeral-ai-log-explainer", "Log line → plain English",
     "basic", r"""    - route:
        id: ai-log-explainer
        from:
          uri: "timer:logTick?period=60000"
          steps:
            - setBody:
                constant: "Back-off restarting failed container worker in pod iflow-demo-worker-7f8b9c: CrashLoopBackOff"
            - setBody:
                simple: "Explain this Kubernetes log line in one sentence for a platform engineer:\n${body}"
            - to:
                uri: "langchain4j-chat:explainer"
            - log:
                message: "Explanation: ${body}"
"""),
    ("18-policy-qa.yaml", "ephemeral-ai-policy-qa", "Policy text + question",
     "deterministic", r"""    - route:
        id: ai-policy-qa
        from:
          uri: "timer:policyTick?period=120000"
          steps:
            - setProperty:
                name: policy
                constant: |
                  Data retention: application logs 30 days, audit logs 1 year, ephemeral worker pods deleted when TTL expires or CR is removed.
            - setProperty:
                name: question
                constant: "How long are audit logs kept?"
            - setBody:
                simple: "Policy:\n${exchangeProperty.policy}\n\nAnswer using ONLY the policy. Question: ${exchangeProperty.question}"
            - to:
                uri: "langchain4j-chat:policy"
            - log:
                message: "Policy answer: ${body}"
"""),
    ("19-multilingual-reply.yaml", "ephemeral-ai-multilingual", "Reply in detected language",
     "basic", r"""    - route:
        id: ai-multilingual
        from:
          uri: "timer:langTick?period=90000"
          steps:
            - setBody:
                constant: "¿Cómo despliego un flujo efímero en OpenShift sin usar Git?"
            - setBody:
                simple: "${body}\n\nRespond helpfully in the same language as the question."
            - to:
                uri: "langchain4j-chat:multilingual"
            - log:
                message: "Reply: ${body}"
"""),
    ("20-route-from-description.yaml", "ephemeral-ai-route-gen", "NL description → Camel YAML snippet",
     "long", r"""    - route:
        id: ai-route-gen
        from:
          uri: "timer:routeGenTick?period=180000"
          steps:
            - setBody:
                constant: "Every 10 seconds log hello, then call https://api.github.com/users/octocat and log the login field."
            - setBody:
                simple: "Generate a minimal Camel YAML route (kaotoDesign style) for:\n${body}\nReturn YAML only, no explanation."
            - to:
                uri: "langchain4j-chat:route-gen"
            - log:
                message: "Generated route YAML:\n${body}"
"""),
]


def main() -> None:
    BASE.mkdir(parents=True, exist_ok=True)
    for filename, name, title, props_key, routes in EXAMPLES:
        props = COMMON_PROPS[props_key]
        if props_key == "basic" and "code-review" in filename:
            props = props.replace('temperature: "0.7"', 'temperature: "0.2"')
        content = HEADER.format(title=title, name=name, props=props) + routes
        (BASE / filename).write_text(content)
        print(f"Wrote {filename}")
    print(f"Total: {len(EXAMPLES)} files in {BASE}")


if __name__ == "__main__":
    main()
