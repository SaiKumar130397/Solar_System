pipeline {
    agent any

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timestamps()
        ansiColor('xterm')
        disableConcurrentBuilds(abortPrevious: true)
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

        stage('Install Dependencies') {
            steps {
                sh 'npm install'
            }
        }

        stage('OWASP Dependency Scan') {
            steps {
                sh '''
                dependency-check.sh \
                --project solar-system \
                --scan . \
                --format HTML \
                --out reports
                '''
            }
        }
    }
}