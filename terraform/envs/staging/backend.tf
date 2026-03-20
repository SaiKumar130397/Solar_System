terraform {
  backend "s3" {
    bucket         = "solarsystem-tf-state"
    key            = "staging/terraform.tfstate"
    region         = "ap-southeast-2"
    encrypt        = true
  }
}
