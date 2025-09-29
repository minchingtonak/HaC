export enum MemorySize {
  MB_512 = 512,
  GB_1 = 1024,
  GB_2 = 2048,
  GB_4 = 4096,
  GB_8 = 8192,
  GB_16 = 16384,
  GB_32 = 32768,
}

export enum DiskSize {
  GB_8 = 8,
  GB_16 = 16,
  GB_32 = 32,
  GB_64 = 64,
}

export enum CpuCores {
  SINGLE = 1,
  DUAL = 2,
  QUAD = 4,
  HEXA = 6,
  OCTA = 8,
  TWELVE = 12,
  SIXTEEN = 16,
}

export enum CommonPorts {
  SSH = 22,
  HTTP = 80,
  HTTPS = 443,
  DNS = 53,
  DHCP = 67,
  MYSQL = 3306,
  POSTGRESQL = 5432,
  REDIS = 6379,
  MONGODB = 27017,
  GRAFANA = 3000,
  PROMETHEUS = 9090,
  DOCKER = 2376,
}

export enum PveFirewallDirection {
  in = 'in',
  out = 'out'
}

export enum PveFirewallPolicy {
  ACCEPT = 'ACCEPT',
  REJECT = 'REJECT',
  DROP = 'DROP',
}

// https://pve.proxmox.com/pve-docs/pve-admin-guide.html#pve_firewall_host_specific_configuration
export enum PveFirewallLogLevel {
  emerg = 'emerg',
  alert = 'alert',
  crit = 'crit',
  err = 'err',
  warning = 'warning',
  notice = 'notice',
  info = 'info',
  debug = 'debug',
  nolog = 'nolog',
}

// https://pve.proxmox.com/pve-docs/pve-admin-guide.html#_firewall_macro_definitions
export enum PveFirewallMacro {
  /** Amanda Backup - udp/tcp 10080 */
  Amanda = 'Amanda',
  /** Auth (identd) traffic - tcp 113 */
  Auth = 'Auth',
  /** Border Gateway Protocol traffic - tcp 179 */
  BGP = 'BGP',
  /** BitTorrent traffic for BitTorrent 3.1 and earlier - tcp 6881:6889, udp 6881 */
  BitTorrent = 'BitTorrent',
  /** BitTorrent traffic for BitTorrent 3.2 and later - tcp 6881:6999, udp 6881 */
  BitTorrent32 = 'BitTorrent32',
  /** Concurrent Versions System pserver traffic - tcp 2401 */
  CVS = 'CVS',
  /** Ceph Storage Cluster traffic (Ceph Monitors, OSD & MDS Daemons) - tcp 6789, 3300, 6800:7300 */
  Ceph = 'Ceph',
  /** Citrix/ICA traffic (ICA, ICA Browser, CGP) - tcp 1494, 2598; udp 1604 */
  Citrix = 'Citrix',
  /** Digital Audio Access Protocol traffic (iTunes, Rythmbox daemons) - tcp/udp 3689 */
  DAAP = 'DAAP',
  /** Distributed Checksum Clearinghouse spam filtering mechanism - tcp 6277 */
  DCC = 'DCC',
  /** Forwarded DHCP traffic - udp 67:68 */
  DHCPfwd = 'DHCPfwd',
  /** DHCPv6 traffic - udp 546:547 */
  DHCPv6 = 'DHCPv6',
  /** Domain Name System traffic (udp and tcp) - udp/tcp 53 */
  DNS = 'DNS',
  /** Distributed Compiler service - tcp 3632 */
  Distcc = 'Distcc',
  /** File Transfer Protocol - tcp 21 */
  FTP = 'FTP',
  /** Finger protocol (RFC 742) - tcp 79 */
  Finger = 'Finger',
  /** GNUnet secure peer-to-peer networking traffic - tcp/udp 2086, 1080 */
  GNUnet = 'GNUnet',
  /** Generic Routing Encapsulation tunneling protocol - proto 47 */
  GRE = 'GRE',
  /** Git distributed revision control traffic - tcp 9418 */
  Git = 'Git',
  /** OpenPGP HTTP key server protocol traffic - tcp 11371 */
  HKP = 'HKP',
  /** Hypertext Transfer Protocol (WWW) - tcp 80 */
  HTTP = 'HTTP',
  /** Hypertext Transfer Protocol (WWW) over SSL - tcp 443 */
  HTTPS = 'HTTPS',
  /** Internet Cache Protocol V2 (Squid) traffic - udp 3130 */
  ICPV2 = 'ICPV2',
  /** AOL Instant Messenger traffic - tcp 5190 */
  ICQ = 'ICQ',
  /** Internet Message Access Protocol - tcp 143 */
  IMAP = 'IMAP',
  /** Internet Message Access Protocol over SSL - tcp 993 */
  IMAPS = 'IMAPS',
  /** IPIP capsulation traffic - proto 94 */
  IPIP = 'IPIP',
  /** IPsec traffic - udp 500, proto 50 */
  IPsec = 'IPsec',
  /** IPsec authentication (AH) traffic - udp 500, proto 51 */
  IPsecah = 'IPsecah',
  /** IPsec traffic and Nat-Traversal - udp 500, 4500; proto 50 */
  IPsecnat = 'IPsecnat',
  /** Internet Relay Chat traffic - tcp 6667 */
  IRC = 'IRC',
  /** HP Jetdirect printing - tcp 9100 */
  Jetdirect = 'Jetdirect',
  /** Layer 2 Tunneling Protocol traffic - udp 1701 */
  L2TP = 'L2TP',
  /** Lightweight Directory Access Protocol traffic - tcp 389 */
  LDAP = 'LDAP',
  /** Secure Lightweight Directory Access Protocol traffic - tcp 636 */
  LDAPS = 'LDAPS',
  /** Multicast DNS - udp 5353 */
  MDNS = 'MDNS',
  /** Microsoft Notification Protocol - tcp 1863 */
  MSNP = 'MSNP',
  /** Microsoft SQL Server - tcp 1433 */
  MSSQL = 'MSSQL',
  /** Mail traffic (SMTP, SMTPS, Submission) - tcp 25, 465, 587 */
  Mail = 'Mail',
  /** Munin networked resource monitoring traffic - tcp 4949 */
  Munin = 'Munin',
  /** MySQL server - tcp 3306 */
  MySQL = 'MySQL',
  /** NNTP traffic (Usenet) - tcp 119 */
  NNTP = 'NNTP',
  /** Encrypted NNTP traffic (Usenet) - tcp 563 */
  NNTPS = 'NNTPS',
  /** Network Time Protocol (ntpd) - udp 123 */
  NTP = 'NTP',
  /** IPv6 neighbor solicitation, neighbor and router advertisement - icmpv6 */
  NeighborDiscovery = 'NeighborDiscovery',
  /** OSPF multicast traffic - proto 89 */
  OSPF = 'OSPF',
  /** OpenVPN traffic - udp 1194 */
  OpenVPN = 'OpenVPN',
  /** Symantec PCAnywere (tm) - tcp 5631, udp 5632 */
  PCA = 'PCA',
  /** Proxmox Mail Gateway web interface - tcp 8006 */
  PMG = 'PMG',
  /** POP3 traffic - tcp 110 */
  POP3 = 'POP3',
  /** Encrypted POP3 traffic - tcp 995 */
  POP3S = 'POP3S',
  /** Point-to-Point Tunneling Protocol - proto 47, tcp 1723 */
  PPtP = 'PPtP',
  /** ICMP echo request - icmp echo-request */
  Ping = 'Ping',
  /** PostgreSQL server - tcp 5432 */
  PostgreSQL = 'PostgreSQL',
  /** Line Printer protocol printing - tcp 515 */
  Printer = 'Printer',
  /** Microsoft Remote Desktop Protocol traffic - tcp 3389 */
  RDP = 'RDP',
  /** Routing Information Protocol (bidirectional) - udp 520 */
  RIP = 'RIP',
  /** BIND remote management protocol - tcp 953 */
  RNDC = 'RNDC',
  /** Razor Antispam System - tcp 2703 */
  Razor = 'Razor',
  /** Remote time retrieval (rdate) - tcp 37 */
  Rdate = 'Rdate',
  /** Rsync server - tcp 873 */
  Rsync = 'Rsync',
  /** SANE network scanning - tcp 6566 */
  SANE = 'SANE',
  /** Microsoft SMB traffic - tcp 135,139,445; udp 135,445,137:139,1024:65535 */
  SMB = 'SMB',
  /** Samba Web Administration Tool - tcp 901 */
  SMBswat = 'SMBswat',
  /** Simple Mail Transfer Protocol - tcp 25 */
  SMTP = 'SMTP',
  /** Encrypted Simple Mail Transfer Protocol - tcp 465 */
  SMTPS = 'SMTPS',
  /** Simple Network Management Protocol - udp 161:162, tcp 161 */
  SNMP = 'SNMP',
  /** Spam Assassin SPAMD traffic - tcp 783 */
  SPAMD = 'SPAMD',
  /** Proxmox VE SPICE display proxy traffic - tcp 3128 */
  SPICEproxy = 'SPICEproxy',
  /** Secure shell traffic - tcp 22 */
  SSH = 'SSH',
  /** Subversion server (svnserve) - tcp 3690 */
  SVN = 'SVN',
  /** SixXS IPv6 Deployment and Tunnel Broker - tcp 3874, udp 3740,5072,8374; proto 41 */
  SixXS = 'SixXS',
  /** Squid web proxy traffic - tcp 3128 */
  Squid = 'Squid',
  /** Mail message submission traffic - tcp 587 */
  Submission = 'Submission',
  /** Syslog protocol (RFC 5424) traffic - udp/tcp 514 */
  Syslog = 'Syslog',
  /** Trivial File Transfer Protocol traffic - udp 69 */
  TFTP = 'TFTP',
  /** Telnet traffic - tcp 23 */
  Telnet = 'Telnet',
  /** Telnet over SSL - tcp 992 */
  Telnets = 'Telnets',
  /** RFC 868 Time protocol - tcp 37 */
  Time = 'Time',
  /** Traceroute (for up to 30 hops) traffic - udp 33434:33524, icmp echo-request */
  Trcrt = 'Trcrt',
  /** VNC traffic for VNC display's 0 - 99 - tcp 5900:5999 */
  VNC = 'VNC',
  /** VNC traffic from Vncservers to Vncviewers in listen mode - tcp 5500 */
  VNCL = 'VNCL',
  /** WWW traffic (HTTP and HTTPS) - tcp 80, 443 */
  Web = 'Web',
  /** Web Cache/Proxy traffic (port 8080) - tcp 8080 */
  Webcache = 'Webcache',
  /** Webmin traffic - tcp 10000 */
  Webmin = 'Webmin',
  /** Whois (nicname, RFC 3912) traffic - tcp 43 */
  Whois = 'Whois',
}
