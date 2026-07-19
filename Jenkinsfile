pipeline {

    // version 1.0.0 - migrated from jenkinsfile-starter for setmy.info-js (npm/node monorepo)
    // Maven placeholders from the starter are replaced with real npm lifecycle
    // scripts (see README.md / temp.md for the full Maven <-> npm phase mapping).
    // Node/npm must be resolvable on the agent PATH (either already on it, e.g.
    // /opt/node/bin, or via a Jenkins NodeJS tool install).
    //
    // Node version / OS matrix: ci.yml (GitHub Actions) runs the Build stage
    // across ubuntu-latest+windows-latest x Node 22+24, using hosted runners
    // that come with matrix support and Node provisioning built in. Doing the
    // same here needs Jenkins NodeJS Plugin tool installations (Manage
    // Jenkins > Tools) named e.g. "NodeJS 22"/"NodeJS 24", and Windows agents
    // in the agent pool - both are Jenkins-controller infrastructure this
    // Jenkinsfile has no way to see or provision. Once those tool
    // installations exist, wrap the Build stage in a `matrix { axes { axis {
    // name 'NODE_VERSION'; values '22', '24' } } tools { nodejs "NodeJS
    // ${NODE_VERSION}" } stages { ... } }` block (see
    // https://www.jenkins.io/doc/book/pipeline/syntax/#matrix). Left
    // unimplemented here rather than wired in without being able to verify
    // it against a real Jenkins instance.

    agent any

    environment {
        PATH = "/opt/has/bin:$PATH"

        MASTER_TO_LIVE = 'DEPLOY'

        MASTER_TO_PRELIVE = 'DEPLOY'
        RELEASE_TO_PRELIVE = 'DEPLOY'

        // "TEST", not "TESTING" - ADR-0041's canonical environment name.
        DEVELOPMENT_TO_TEST = 'DEPLOY'
        RELEASE_TO_TEST = 'DEPLOY'

        DEVELOPMENT_TO_DEV = 'DEPLOY'
        RELEASE_TO_DEV = 'DEPLOY'
    }

    stages {
        stage('Inspection') {
            parallel {
                stage('Pre-build') {
                    steps {
                        echo 'Pre build inspection and precondition check.'
                        sh 'node --version'
                        sh 'npm --version'
                        // fileExists only RETURNS a boolean - as a bare
                        // statement its result is discarded and a missing
                        // file fails nothing. It must be wrapped to gate.
                        script {
                            if (!fileExists('README.md')) {
                                error('README.md missing - checkout incomplete or wrong workspace directory')
                            }
                        }
                    }
                }
                stage('Build tools') {
                    steps {
                        echo 'Build tools installation and preparation (npm ci)'
                        sh 'npm run bootstrap'
                    }
                }
            }
        }

        // Everything from here down to and including 'Package' runs on every
        // branch, feature branches included - the point (per our git branching
        // model) is that a developer on a feature branch gets the same build,
        // lint, test and quality feedback as devel/release/master, without
        // ever reaching the Publish/Deploy/Tag stages below, which are gated
        // to specific branches only.

        stage('Preparation') {
            steps {
                echo 'Preparing the workspace to be built.'
                sh 'npm run clean'
                sh 'npm run validate'
            }
        }

        stage('Build') {
            steps {
                echo 'Format/lint check (Maven validate phase equivalent)'
                sh 'npm run format:check'
                sh 'npm run lint'

                // "ci" is ADR-0041's canonical name for this environment -
                // Jenkins IS the ci environment here, so resources get
                // filtered with the ci profile's property values.
                echo 'Resource filtering (Maven generate-resources/process-resources phase equivalent)'
                sh 'npm run resources -- --profile ci'

                echo 'Compile (esbuild bundle, Maven compile phase equivalent)'
                sh 'npm run build'

                echo 'Unit tests'
                sh 'npm test'

                echo 'Integration tests (*IT-equivalent)'
                sh 'npm run pre-integration-test'
                sh 'npm run integration-test'
            }
            post {
                // Guaranteed cleanup even if integration-test fails, the same
                // way Maven's failsafe plugin always runs post-integration-test
                // around a possibly failing integration-test goal.
                always {
                    sh 'npm run post-integration-test'
                }
            }
        }

        stage('E2E') {
            steps {
                echo 'e2e tests (-Pe2e equivalent, *E2ET-style)'
                sh 'npm run pre-e2e-test'
                sh 'npm run e2e-test'
            }
            post {
                always {
                    sh 'npm run post-e2e-test'
                }
            }
        }

        stage('Quality') {
            steps {
                echo 'Put here mutation tests once a JS mutation-testing tool (e.g. Stryker) is wired in'

                echo 'Coverage, security (dependency-check equivalent), artifact verification'
                sh 'npm run coverage'
                sh 'npm run security'
                sh 'npm run verify'

                echo 'Reporting: docs, lint report, coverage report, security report, dependency tree (mvn site equivalent)'
                sh 'npm run site'

                // ci.yml's Publish/release-reports job does the real
                // GitHub-Pages version of this. There's no Jenkins
                // equivalent of "push to GitHub Pages" without pushing to
                // GitHub itself as a side effect of a Jenkins build, which
                // needs its own credentials/target decision - left as a
                // placeholder here on purpose rather than guessing at one.
                echo 'Put here site deploy, e.g. publish site/ to an internal reports host'
            }
        }

        stage('System/Acceptance') {
            steps {
                echo 'Put here system tests'
                echo 'Put here acceptance tests'
            }
        }

        stage('Package') {
            steps {
                echo 'Packaging'
                sh 'npm run package'
                sh 'npm run sbom'
                sh 'npm run sign'
            }
        }

        stage('Publish') {
            parallel {
                stage('Release') {
                    when {
                        branch 'master'
                    }
                    steps {
                        echo 'Software release publish steps'
                        sh 'npm run install-local'
                        sh 'npm run publish'
                    }
                }
                stage('Snapshot') {
                    when {
                        expression { env.BRANCH_NAME.startsWith('devel') }
                    }
                    steps {
                        echo 'Software snapshot publish steps'
                        sh 'npm run install-local'
                        sh 'npm run publish'
                    }
                }
                stage('Release reports') {
                    when {
                        branch 'master'
                    }
                    steps {
                        echo 'Put here reports publishing steps (deploy site/ output)'
                    }
                }
                stage('Snapshot reports') {
                    when {
                        expression { env.BRANCH_NAME.startsWith('devel') }
                    }
                    steps {
                        echo 'Put here reports publishing steps (deploy site/ output)'
                    }
                }
            }
        }

        stage('Deploy') {
            parallel {
                stage('dev') {
                    when {
                        expression {
                            (env.DEVELOPMENT_TO_DEV == 'DEPLOY' && env.BRANCH_NAME.startsWith('devel')) ||
                            (env.RELEASE_TO_DEV == 'DEPLOY' && env.BRANCH_NAME.startsWith('release'))
                        }
                    }
                    steps {
                        echo 'Development environment installation steps'
                        sh 'DEPLOY_TARGET=dev npm run deploy'
                    }
                }
                stage('test') {
                    when {
                        expression {
                            (env.DEVELOPMENT_TO_TEST == 'DEPLOY' && env.BRANCH_NAME.startsWith('devel')) ||
                            (env.RELEASE_TO_TEST == 'DEPLOY' && env.BRANCH_NAME.startsWith('release'))
                        }
                    }
                    steps {
                        echo 'Test environment installation steps'
                        sh 'DEPLOY_TARGET=test npm run deploy'
                    }
                }
                stage('prelive') {
                    when {
                        expression {
                            env.RELEASE_TO_PRELIVE == 'DEPLOY' && env.BRANCH_NAME.startsWith('release')
                        }
                    }
                    steps {
                        echo 'Prelive environment installation steps'
                        sh 'DEPLOY_TARGET=prelive npm run deploy'
                    }
                }
                stage('live') {
                    when {
                        expression {
                            env.MASTER_TO_LIVE == 'DEPLOY' && env.BRANCH_NAME == 'master'
                        }
                    }
                    steps {
                        echo 'Production environment installation steps'
                        sh 'DEPLOY_TARGET=live npm run deploy'
                    }
                }
            }
        }

        stage('Tag') {
            when {
                branch 'master'
                expression { env.MASTER_TO_LIVE == 'DEPLOY' }
            }
            steps {
                echo 'Put here tagging steps'
            }
        }
    }

    post {
        always {
            sh 'echo "Always"'
        }

        success {
            emailext (
                subject: "Jenkins job: $JOB_NAME, build: $BUILD_NUMBER type: SUCCESSFUL",
                body: "Job: $JOB_NAME, build: $BUILD_NUMBER, url: ${env.BUILD_URL}, git: ${env.GIT_URL}, branch: ${env.GIT_BRANCH} SUCCESSFUL post step",
                recipientProviders: [[$class: 'DevelopersRecipientProvider']]
            )
        }

        failure {
            emailext (
                subject: "Jenkins job: $JOB_NAME, build: $BUILD_NUMBER type: FAILED",
                body: "Job: $JOB_NAME, build: $BUILD_NUMBER, url: ${env.BUILD_URL}, git: ${env.GIT_URL}, branch: ${env.GIT_BRANCH}  FAILED post step",
                recipientProviders: [[$class: 'DevelopersRecipientProvider']]
            )
        }
    }
}
