output "bucket_name" {
  description = "Value for the backend S3_BUCKET environment variable."
  value       = cloudflare_r2_bucket.assets.name
}

output "s3_endpoint" {
  description = "Value for the backend S3_ENDPOINT environment variable."
  value       = "https://${var.cloudflare_account_id}.r2.cloudflarestorage.com"
}
