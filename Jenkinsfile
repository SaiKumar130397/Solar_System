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
                script {
                    sh '''
                    docker run -d --name mongo-test \
                    -e MONGO_INITDB_ROOT_USERNAME=testuser \
                    -e MONGO_INITDB_ROOT_PASSWORD=testpass \
                    -p 27017:27017 \
                    mongo:7
                    '''

                    sleep 15

                    withEnv([
                        "MONGO_URI=mongodb://testuser:testpass@localhost:27017/testdb?authSource=admin",
                        "MONGO_USERNAME=testuser",
                        "MONGO_PASSWORD=testpass"
                    ]) {
                        sh 'npm test'
                    }
                    post {
                        always {
                            sh 'docker rm -f mongo-test'
                        }
                    }
                }
            }
        }
    }
}