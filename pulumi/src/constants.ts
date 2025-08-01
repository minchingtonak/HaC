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

export enum ProxmoxFirewallPolicy {
  ACCEPT = 'ACCEPT',
  REJECT = 'REJECT',
  DROP = 'DROP',
}

export enum ProxmoxFirewallLogLevel {
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
