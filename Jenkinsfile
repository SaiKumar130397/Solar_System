pipeline {
    agent any
    tools {
        nodejs 'nodejs-22-6-0'
    }
    stages {
        stage('Install Dependencies') {
            steps {
                sh 'npm install'
            }
        }
    }
}