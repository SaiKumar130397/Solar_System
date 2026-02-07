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
        SNYK_TOKEN = credentials('snyk-token')
        AWS_REGION = "ap-southeast-2"
        AWS_ACCOUNT_ID = "424322298246"
        ECR_REPO = "solar-system"
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

        stage('SonarQube Analysis') {
            steps {
                withSonarQubeEnv('SonarQube') {
                    sh """
                        ${tool 'SonarScanner'}/bin/sonar-scanner \
                        -Dsonar.projectKey=solar-system \
                        -Dsonar.sources=. \
                    """
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    IMAGE_TAG = "${env.BUILD_NUMBER}"
                }
                sh """
                    docker build -t solar-system:${IMAGE_TAG} .
                """
            }
        }

        stage('Snyk Container Scan') {
            steps {
                withCredentials([string(credentialsId: 'snyk-token', variable: 'SNYK_TOKEN')]) {
                    sh """
                        snyk container test solar-system:${IMAGE_TAG} \
                        --org=saikumar130397 || true  
                    """
                }
            }
        }

        stage('Push to ECR') {
            steps {
                script {
                    sh """
                    aws ecr get-login-password --region ${AWS_REGION} \
                    | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

                    docker tag solar-system:${BUILD_NUMBER} \
                    ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}:${BUILD_NUMBER}

                    docker push \
                    ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}:${BUILD_NUMBER}
                    """
                }
            }
        }
    }
}