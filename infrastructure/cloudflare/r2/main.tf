variable "cloudflare_account_id" {
  description = "Cloudflare account that owns the production R2 bucket."
  type        = string
}

variable "bucket_name" {
  description = "Globally unique name of the production object bucket."
  type        = string
  default     = "rezics-production"
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
