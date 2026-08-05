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
      id      = "retain-daily-for-eight-days"
      enabled = true
      prefix  = "postgresql/daily/"
      condition = {
        type            = "Age"
        max_age_seconds = 691200
      }
    },
    {
      id      = "retain-weekly-for-thirty-five-days"
      enabled = true
      prefix  = "postgresql/weekly/"
      condition = {
        type            = "Age"
        max_age_seconds = 3024000
      }
    },
    {
      id      = "retain-monthly-for-three-hundred-seventy-days"
      enabled = true
      prefix  = "postgresql/monthly/"
      condition = {
        type            = "Age"
        max_age_seconds = 31968000
      }
    },
  ]
}

resource "cloudflare_r2_bucket_lifecycle" "postgres_backups" {
  account_id   = var.cloudflare_account_id
  bucket_name  = cloudflare_r2_bucket.postgres_backups.name
  jurisdiction = var.backup_bucket_jurisdiction

  rules = [
    {
      id         = "delete-daily-after-nine-days"
      enabled    = true
      conditions = { prefix = "postgresql/daily/" }
      delete_objects_transition = {
        condition = { type = "Age", max_age = 777600 }
      }
    },
    {
      id         = "delete-weekly-after-thirty-six-days"
      enabled    = true
      conditions = { prefix = "postgresql/weekly/" }
      delete_objects_transition = {
        condition = { type = "Age", max_age = 3110400 }
      }
    },
    {
      id         = "archive-and-delete-monthly"
      enabled    = true
      conditions = { prefix = "postgresql/monthly/" }
      storage_class_transitions = [{
        condition     = { type = "Age", max_age = 2592000 }
        storage_class = "InfrequentAccess"
      }]
      delete_objects_transition = {
        condition = { type = "Age", max_age = 32054400 }
      }
    },
    {
      id         = "abort-incomplete-multipart-uploads"
      enabled    = true
      conditions = { prefix = "postgresql/" }
      abort_multipart_uploads_transition = {
        condition = { type = "Age", max_age = 86400 }
      }
    },
  ]
}
