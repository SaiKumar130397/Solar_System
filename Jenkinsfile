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
                withCredentials([string(credentialsId: 'nvd-api-key', variable: 'NVD_API_KEY')]) {
                    dependencyCheck additionalArguments: """
                        --project solar-system
                        --scan .
                        --format XML
                        --format HTML
                        --out reports
                        --failOnCVSS 8
                        --nvdApiKey ${NVD_API_KEY}
                    """,
                    odcInstallation: 'dependency-check'
                }
            }
            post {
                always {
                    dependencyCheckPublisher pattern: 'reports/dependency-check-report.xml'
                }
                failure {
                    sh '''
                    aws s3 cp reports/ \
                    s3://solar-system-security-reports/${BUILD_NUMBER}/ \
                    --recursive
                    '''
                }
            }
        }

        stage('Unit Testing') {
            steps {
                sh 'npm test'
            }
        }
    }
}