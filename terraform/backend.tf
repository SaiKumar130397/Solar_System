terraform {
  required_version = ">= 1.5"

  backend "s3" {
    bucket         = "solar-system-tf-state"
    key            = "eks/terraform.tfstate"
    region         = "ap-south-1"
    dynamodb_table = "solar-system-tf-lock"
    encrypt        = true
  }
}
