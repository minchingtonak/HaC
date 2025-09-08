#!/bin/sh

wget -qO- https://get.docker.com | sh

# enable socket on port 2376
OVERRIDE_DIR='/etc/systemd/system/docker.service.d'
mkdir -p "$OVERRIDE_DIR"
echo '''
[Service]
ExecStart=
ExecStart=/usr/bin/dockerd -H fd:// -H tcp://0.0.0.0:2376 --containerd=/run/containerd/containerd.sock
''' > "$OVERRIDE_DIR/override.conf"

systemctl daemon-reload

systemctl restart docker.service
