variable "project_root" {
  description = "Absolute path to the project root"
  type        = string
}

variable "network" {
  description = "Docker network name"
  type        = string
  default     = "rezics"
}

// Postgres

variable "postgres_user" {
  type    = string
  default = "postgres"
}

variable "postgres_password" {
  type    = string
  default = "postgres"
}

// Meilisearch

variable "meili_master_key" {
  type    = string
  default = "masterKey"
}

// RustFS (S3)

variable "rustfs_root_user" {
  type    = string
  default = "rustfsadmin"
}

variable "rustfs_root_password" {
  type    = string
  default = "rustfsadmin"
}

variable "rustfs_bucket" {
  type    = string
  default = "rezics"
}

// Sequin

variable "sequin_secret_key_base" {
  type    = string
  default = "ENxZNJ8GgthCCaRFFuOUO8ZgSVihwgDsrwyEzzbqGM8aym4V9tlsR2cwv7VN5I9v"
}

variable "sequin_vault_key" {
  type    = string
  default = "wYd0etI+QcXxPj0Qq6cFkI91TSSK7IlQvcToD+JJnjY="
}

variable "sequin_webhook_secret" {
  type    = string
  default = "6a4ded3260d452d5ce5afc38f440abba8c966dabdd8a755ef53238c2cd3c6347"
}
