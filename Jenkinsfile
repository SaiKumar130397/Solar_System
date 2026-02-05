pipeline {
    agent any

    environment {
        AWS_region = "ap-southeast-2"
        AWS_credentials = credentials("aws-creds")
        Github_credentials = credentials("github-creds")
    }
    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }
    }
}