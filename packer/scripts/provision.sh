#!/bin/bash

# Debian 12 LXC Container Provisioning Script
# This script runs during the Packer build process to customize the container

set -e

echo "Starting custom provisioning for Debian 12 LXC container..."

# Update package lists
echo "Updating package lists..."
apt-get update

# Install essential packages
echo "Installing essential packages..."
apt-get install -y \
    curl \
    wget \
    vim \
    nano \
    htop \
    tree \
    git \
    unzip \
    ca-certificates \
    gnupg \
    lsb-release \
    software-properties-common \
    apt-transport-https

# Install additional utilities
echo "Installing additional utilities..."
apt-get install -y \
    net-tools \
    iputils-ping \
    dnsutils \
    telnet \
    tcpdump \
    rsync \
    screen \
    tmux \
    jq

# Configure timezone (optional - uncomment and modify as needed)
# echo "Configuring timezone..."
# timedatectl set-timezone America/New_York

# Create a non-root user (optional - uncomment and modify as needed)
# echo "Creating non-root user..."
# useradd -m -s /bin/bash -G sudo debian
# echo "debian:debian" | chpasswd

# Configure SSH (if needed)
echo "Configuring SSH..."
apt install -y openssh-server
systemctl enable ssh
systemctl start ssh

# Set up basic security configurations
echo "Applying basic security configurations..."

# Update SSH configuration for better security
sed -i 's/#PermitRootLogin yes/PermitRootLogin yes/' /etc/ssh/sshd_config
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config

# Configure automatic security updates (optional)
echo "Configuring automatic security updates..."
apt-get install -y unattended-upgrades
echo 'Unattended-Upgrade::Automatic-Reboot "false";' >> /etc/apt/apt.conf.d/50unattended-upgrades

# Install Docker (optional - uncomment if needed)
# echo "Installing Docker..."
# curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
# echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
# apt-get update
# apt-get install -y docker-ce docker-ce-cli containerd.io
# systemctl enable docker
# usermod -aG docker debian

# Clean up package cache
echo "Cleaning up package cache..."
apt-get autoremove -y
apt-get autoclean

# Create custom motd
echo "Creating custom MOTD..."
cat > /etc/motd << 'EOF'
 ____       _     _             _ ____
|  _ \  ___| |__ (_) __ _ _ __ / |___ \
| | | |/ _ \ '_ \| |/ _` | '_ \| | __) |
| |_| |  __/ |_) | | (_| | | | | |/ __/
|____/ \___|_.__/|_|\__,_|_| |_|_|_____|

Debian 12 LXC Template
Built with Packer

EOF

# Set up basic aliases
echo "Setting up basic aliases..."
cat >> /root/.bashrc << 'EOF'

# Custom aliases
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'
alias ..='cd ..'
alias ...='cd ../..'
alias grep='grep --color=auto'
alias fgrep='fgrep --color=auto'
alias egrep='egrep --color=auto'

EOF

# Configure vim with basic settings
echo "Configuring vim..."
cat > /root/.vimrc << 'EOF'
set number
set tabstop=4
set shiftwidth=4
set expandtab
set autoindent
set smartindent
syntax on
set hlsearch
set incsearch
set ignorecase
set smartcase
EOF

# Set up log rotation for custom applications (optional)
echo "Setting up log rotation..."
cat > /etc/logrotate.d/custom-apps << 'EOF'
/var/log/custom/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 root root
}
EOF

# Create directories for custom applications
mkdir -p /opt/custom
mkdir -p /var/log/custom

# Final system update
echo "Performing final system update..."
apt-get update && apt-get upgrade -y

echo "Provisioning completed successfully!"
echo "Container is ready for template creation."
