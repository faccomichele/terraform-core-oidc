# S3 bucket for static assets (login page, landing page)
resource "aws_s3_bucket" "assets" {
  bucket_prefix = "${local.project_name}-${local.environment}-assets-"

  tags = {
    Name = "${local.project_name}-${local.environment}-assets"
  }
}

# Configure public access for the bucket (allow bucket policy for static website hosting)
resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id

  block_public_acls       = true
  block_public_policy     = false # Allow public bucket policy
  ignore_public_acls      = true
  restrict_public_buckets = false # Allow public bucket policy
}

# Enable versioning for the bucket
resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Enable encryption for the bucket
resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# S3 bucket policy to allow public read access to static files
resource "aws_s3_bucket_policy" "assets" {
  bucket = aws_s3_bucket.assets.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.assets.arn}/*"
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.assets]
}


# Upload login page HTML
resource "aws_s3_object" "login_page" {
  bucket       = aws_s3_bucket.assets.id
  key          = "login.html"
  content_type = "text/html"
  content = templatefile("${path.module}/static/login.html", {
    api_url = "${aws_api_gateway_deployment.oidc.invoke_url}${local.environment}"
  })

  etag = filemd5("${path.module}/static/login.html")

  tags = {
    Name = "login-page"
  }
}

# Upload landing page HTML
resource "aws_s3_object" "landing_page" {
  bucket       = aws_s3_bucket.assets.id
  key          = "landing.html"
  content_type = "text/html"
  content = templatefile("${path.module}/static/landing.html", {
    api_url = "${aws_api_gateway_deployment.oidc.invoke_url}${local.environment}"
  })

  etag = filemd5("${path.module}/static/landing.html")

  tags = {
    Name = "landing-page"
  }
}
