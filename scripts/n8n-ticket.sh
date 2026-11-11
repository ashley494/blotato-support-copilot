#!/usr/bin/env bash
# Sends one ticket to the local n8n flow and prints the result.
# Usage: scripts/n8n-ticket.sh "customer message" [status] [draftReply]
set -euo pipefail
msg="${1:?customer message}"; status="${2:-}"; draft="${3:-}"
body=$(node -e 'const [m,s,d]=process.argv.slice(1);const b={message:m};if(s)b.status=Number(s);if(d)b.draftReply=d;process.stdout.write(JSON.stringify(b))' "$msg" "$status" "$draft")
curl -s -w '\n(HTTP %{http_code})\n' -H 'content-type: application/json' -d "$body" "${N8N_URL:-http://localhost:5678}/webhook/support-ticket" \
 | node -e 'let r="";process.stdin.on("data",c=>r+=c).on("end",()=>{const [j,code]=r.split("\n(HTTP ");try{const o=JSON.parse(j);console.log(`Route:     ${o.route.toUpperCase()}  (${o.why})`);console.log(`Diagnosis: ${o.diagnosis.title}`);console.log(`Cause:     ${o.diagnosis.cause}`);console.log(`Reply:     ${o.reply}`);console.log(`Gate:      ${o.gate.score}/10 ${o.gate.pass?"PASS":"HOLD"}${o.gate.toFix.length?"  fix: "+o.gate.toFix.join("; "):""}`)}catch{console.log(r)}})'
