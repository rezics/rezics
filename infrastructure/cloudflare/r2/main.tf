variable "cloudflare_account_id" {
  description = "Cloudflare account that owns the production R2 bucket."
  type        = string
}

variable "bucket_name" {
  description = "Globally unique name of the production object bucket."
  type        = string
  default     = "rezics-production"
}

variable "backup_bucket_name" {
  description = "Globally unique name of the private PostgreSQL logical-backup bucket."
  type        = string
  default     = "rezics-production-postgres-backups"
}

variable "backup_bucket_location" {
  description = "Best-effort immutable R2 location selected before bucket creation."
  type        = string

  validation {
    condition     = contains(["apac", "eeur", "enam", "weur", "wnam", "oc"], var.backup_bucket_location)
    error_message = "backup_bucket_location must be an R2 location code."
  }
}

variable "backup_bucket_jurisdiction" {
  description = "Immutable data-residency jurisdiction selected before bucket creation."
  type        = string
  default     = "default"

  validation {
    condition     = contains(["default", "eu", "fedramp"], var.backup_bucket_jurisdiction)
    error_message = "backup_bucket_jurisdiction must be default, eu, or fedramp."
  }
}

provider "cloudflare" {}

resource "cloudflare_r2_bucket" "assets" {
  account_id    = var.cloudflare_account_id
  name          = var.bucket_name
  storage_class = "Standard"

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_r2_bucket_cors" "assets" {
  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.assets.name

  rules = [{
    id = "rezics-web-presigned-objects"
    allowed = {
      origins = ["https://www.rezics.com"]
      methods = ["GET", "HEAD", "PUT"]
      headers = [
        "content-type",
        "x-amz-meta-image_asset_id",
        "x-amz-meta-image_object_id",
        "x-amz-meta-uploader_profile_id",
      ]
    }
    expose_headers  = ["etag"]
    max_age_seconds = 3600
  }]
}

resource "cloudflare_r2_bucket" "postgres_backups" {
  account_id    = var.cloudflare_account_id
  name          = var.backup_bucket_name
  location      = var.backup_bucket_location
  jurisdiction  = var.backup_bucket_jurisdiction
  storage_class = "Standard"

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_r2_managed_domain" "postgres_backups" {
  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.postgres_backups.name
  enabled     = false
}

resource "cloudflare_r2_bucket_lock" "postgres_backups" {
  account_id   = var.cloudflare_account_id
  bucket_name  = cloudflare_r2_bucket.postgres_backups.name
  jurisdiction = var.backup_bucket_jurisdiction

  rules = [
    {
      id      = "protect-databasus-recovery-points-for-seven-days"
      enabled = true
      prefix  = "postgresql/databasus/"
      condition = {
        type            = "Age"
        max_age_seconds = 604800
      }
    }
  ]
}

resource "cloudflare_r2_bucket_lifecycle" "postgres_backups" {
  account_id   = var.cloudflare_account_id
  bucket_name  = cloudflare_r2_bucket.postgres_backups.name
  jurisdiction = var.backup_bucket_jurisdiction

  rules = [
    {
      id         = "archive-databasus-recovery-points"
      enabled    = true
      conditions = { prefix = "postgresql/databasus/" }
      storage_class_transitions = [{
        condition     = { type = "Age", max_age = 2592000 }
        storage_class = "InfrequentAccess"
      }]
    },
    {
      id         = "abort-incomplete-multipart-uploads"
      enabled    = true
      conditions = { prefix = "postgresql/databasus/" }
      abort_multipart_uploads_transition = {
        condition = { type = "Age", max_age = 86400 }
      }
    },
  ]
}
