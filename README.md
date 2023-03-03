# Chaos Lord User Service Infra
This repository includes infra setup for user services of Chaos Lord. 

User Service Overview:

    AWS Cognito User Pool   --->  AWS Lambda  --->  AWS DynamoDB

### Stack Configuration
Cognito User Pool:
- User pool client with hosted UI
- User pool custom domain(custom url for user authentication)
- Lambda triggers

More information at: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cognito-readme.html

Lambda(cognito triggers):
- Post user sign up - migrate user to DynamoDB
- Post user sign in - save user session (perhaps to redis) for other services to use(TODO)

More information at: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_lambda-readme.html

DynamoDB(user table):
- Stores users for other services to consume

More information at: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_dynamodb-readme.html

Route53:
- Configures user pool custom domain DNS records

More information at: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_route53-readme.html

### Infra Deploy Flow
Bundle Go lambda functions, for windows:

    $> pre-deploy.cmd
    ...(for windows)
    $> pre-deploy.sh
    ...(for linux)
  
Compare CDK Difference and synth:

    $> cdk diff
    ...
    $> cdk synth
    ...

Run pre proccess before deploy(delete exsiting cognito domain alias record in Route53):

    $> npm run pre-process
    ...
    
Deploy:

    $> cdk deploy
    ...

Run post process(set up aws resources that cant be set up in cdk):

    $> npm run post-process
    ...

The github action CI/CD pipeline follows this

### Project Structure
- ./bin - aws infra entry point
- ./dev - non-infra code such as aws sdk calls
- ./lib - common lib code
- ./logs - logger output folder
- ./public - Cognito user pool UI Customization files
- ./src - lambda source code
- ./test - CDK test code

### Other tools
Conventional commits: https://www.conventionalcommits.org/en/v1.0.0/
eslint - will fix on save file(configured in vscode setting)
