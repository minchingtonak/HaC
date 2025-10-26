#!/bin/bash

#  provisioner should install a script that runs

pveum user add pulse-monitor@pam --comment "Pulse monitoring service"

# user was successfully added, so continue configuring
if [ "$?" = 2 ]; then
    echo "user pulse-monitor@pam already exists, skipping user setup"
else
    API_USER_TOKEN=$(pveum user token add pulse-monitor@pam pulse-token --privsep 0 | grep 'value' | tail -1 | awk '{ print $4; }')

    pveum aclmod / -user pulse-monitor@pam -role PVEAuditor && if pveum role list 2>/dev/null | grep -q "VM.Monitor" || pveum role add TestMonitor -privs VM.Monitor 2>/dev/null; then pveum role delete TestMonitor 2>/dev/null; pveum role delete PulseMonitor 2>/dev/null; pveum role add PulseMonitor -privs VM.Monitor; pveum aclmod / -user pulse-monitor@pam -role PulseMonitor; fi

    pveum aclmod /storage -user pulse-monitor@pam -role PVEDatastoreAdmin
fi

cat > /usr/local/bin/pulse-self-register.sh << EOF
#!/bin/bash
# Construct registration request with setup code
# Build JSON carefully to preserve the exclamation mark
#
# auto-register supports API token auth
# https://github.com/rcourtman/Pulse/blob/2e6936d327e55236ed9cdf81d598405c7fd7599e/internal/api/config_handlers.go#L5047
REGISTER_JSON='{"type":"pve","host":"'"$HOST_URL"'","serverName":"'"$SERVER_HOSTNAME"'","tokenId":"pulse-monitor@pam!pulse-token","tokenValue":"'"$API_USER_TOKEN"'"}'

# Send registration with setup code
REGISTER_RESPONSE=$(echo "\$REGISTER_JSON" | curl -s -X POST "$PULSE_URL/api/auto-register" \
    -H "Content-Type: application/json" \
    -H "X-API-Token: $PULSE_API_TOKEN" \
    -d @- 2>&1)

if echo "$REGISTER_RESPONSE" | grep -q "success"; then
    echo "Node registered successfully"
else
    exit 7
fi
EOF

cat > /usr/local/bin/pulse-self-register-webhook.py << 'EOF'
#!/usr/bin/env python3
from http.server import HTTPServer, BaseHTTPRequestHandler
import subprocess

class WebhookHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        # Run your job
        subprocess.Popen(['/path/to/your/script.sh'])
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'Job started')

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8080), WebhookHandler)
    print('Webhook listening on port 8080...')
    server.serve_forever()

EOF

cat > /etc/systemd/system/pulse-self-register-webhook.service << 'EOF'
[Unit]
Description=Webhook Service
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/usr/local/bin
ExecStart=/usr/bin/python3 /usr/local/bin/webhook.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
