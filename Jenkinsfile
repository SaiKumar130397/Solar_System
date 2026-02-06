pipeline {
    agent any

    options {
        buildDiscarder(logRotator(
            numToKeepStr: '10',
            artifactNumToKeepStr: '5' 
        ))
        timestamps()
        ansiColor('xterm')
        disableConcurrentBuilds(abortPrevious: true)
    }

    environment {
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
                sh 'mkdir -p reports'
                dependencyCheck additionalArguments: '''
                    --project solar-system
                    --scan .
                    --format XML
                    --format HTML
                    --out reports
                    --failOnCVSS 8
                ''',
                odcInstallation: 'dependency-check'
            }
            post {
                always {
                    dependencyCheckPublisher pattern: 'reports/dependency-check-report.xml'
                }
                failure {
                    sh '''
                    aws s3 cp reports/ \
                    s3://solar-system-tf-state/${BUILD_NUMBER}/ \
                    --recursive
                    '''
                }
            }
        }

    }
}