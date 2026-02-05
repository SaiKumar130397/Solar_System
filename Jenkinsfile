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
                    s3://solar-system-reports-${AWS_ACCOUNT_ID}/${BUILD_NUMBER}/ \
                    --recursive
                    '''
                }
            }
        }

    }
}