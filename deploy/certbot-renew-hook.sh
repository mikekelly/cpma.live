#!/bin/bash
# Let's Encrypt renewal deploy hook — restarts the proxy so it picks up the new cert.
# Install to: /etc/letsencrypt/renewal-hooks/deploy/restart-q3proxy.sh
systemctl restart q3proxy
