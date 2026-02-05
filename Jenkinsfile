pipeline {
    agent any
    tools {
        nodejs 'nodejs-22-6-0'
    }
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