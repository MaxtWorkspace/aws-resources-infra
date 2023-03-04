/* eslint-disable @typescript-eslint/ban-types */
import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { AccountRecovery, AdvancedSecurityMode, ClientAttributes, Mfa, OAuthScope, UserPool, UserPoolClientIdentityProvider, UserPoolEmail, VerificationEmailStyle } from 'aws-cdk-lib/aws-cognito';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { config } from './config';

export class LambdaToDynamoStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);
    // generate user pool
    const userPool = this.DeployCognitoUserPool();

    // generate user table
    const table = this.DeployDynamoDB();

    // generate user pool triggers
    const userPoolPolicy = new Policy(this, 'userpool-policy', {
      statements: [new PolicyStatement({
        actions: ['cognito-idp:DescribeUserPool'],
        resources: [userPool.userPoolArn],
      })],
    });

    config.triggers.forEach(trigger => {
      const lambda = this.DeployLambda(trigger.path, trigger.name);
      //grant dynamo permission to lambda
      table.grantReadWriteData(lambda);
      //add lambda as user pool triggers
      userPool.addTrigger(trigger.operation, lambda);
      lambda.role?.attachInlinePolicy(userPoolPolicy);
    });
  }

  private DeployCognitoUserPool() : UserPool {
    // configure user pool
    const userPool = new UserPool(this, config.userPool.userPoolName, {
      userPoolName: config.userPool.userPoolName,
      signInCaseSensitive: false,
      selfSignUpEnabled: true,
      userVerification: {
        emailSubject: 'Chaos Lord Account Verification - Action Required',
        emailBody: 'Hello Fellow Chaos Lord Player,\nWelcome aboard! Please verify your account by following {##Verify Email##}. If you did not sign up for Chaos Lord, please ignore this email.',
        emailStyle: VerificationEmailStyle.LINK,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      signInAliases: { username: true },
      autoVerify: { email: true, phone: true },
      keepOriginal: { email: true, phone: true },
      mfa: Mfa.OPTIONAL,
      mfaSecondFactor: { sms: true, otp: false },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        tempPasswordValidity: Duration.days(3),
      },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      advancedSecurityMode: AdvancedSecurityMode.OFF,
      email: UserPoolEmail.withSES({
        fromEmail: config.userPool.fromEmail,
        fromName: 'Chaos Lord',
        replyTo: config.userPool.replyToEmail,
      }),
      deviceTracking: {
        challengeRequiredOnNewDevice: true,
        deviceOnlyRememberedOnUserPrompt: true,
      },
      deletionProtection: true,
    });

    // configure user pool client
    const clientWriteAttributes = (new ClientAttributes())
      .withStandardAttributes({fullname: true, email: true, phoneNumber: true});
    const clientReadAttributes = clientWriteAttributes
      .withStandardAttributes({emailVerified: true});
    userPool.addClient('chaos-lord-client', {
      authFlows: {
        userPassword: true,
        userSrp: true,
        custom: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [ OAuthScope.EMAIL, OAuthScope.OPENID, OAuthScope.PHONE ],
        callbackUrls: config.userPool.callbackUrls,
      },
      preventUserExistenceErrors: true,
      supportedIdentityProviders: [
        UserPoolClientIdentityProvider.COGNITO,
      ],
      authSessionValidity: Duration.minutes(3),
      accessTokenValidity: Duration.minutes(60),
      idTokenValidity: Duration.minutes(60),
      refreshTokenValidity: Duration.days(30),
      readAttributes: clientReadAttributes,
      writeAttributes: clientWriteAttributes,
      enableTokenRevocation: true,
      generateSecret: true,
    });

    // configure user pool domain
    const domainCert = Certificate.fromCertificateArn(this, 'domainCert', config.domain.certificateArn);
    userPool.addDomain('Custom Domain', {
      customDomain: {
        domainName: config.domain.domainName,
        certificate: domainCert,
      },
    });

    return userPool;
  }

  private DeployDynamoDB() : Table {
    // configure dynamo db table
    const table = new Table(this, config.dbName, {
      tableName: config.dbName,
      partitionKey: { name: 'username', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST, // TODO: Change to provisioned in prod
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // configure auto scale
    /* const readScaling = table.autoScaleReadCapacity({ minCapacity: 1, maxCapacity: 10 });
    readScaling.scaleOnUtilization({
      targetUtilizationPercent: 50,
    });

    readScaling.scaleOnSchedule('ReadScaleUpInTheMorning', {
      schedule: Schedule.cron({ hour: '8', minute: '0' }),
      minCapacity: 5,
    });

    readScaling.scaleOnSchedule('ReadScaleDownAtNight', {
      schedule: Schedule.cron({ hour: '20', minute: '0' }),
      maxCapacity: 5,
    }); */

    return table;
  }

  private DeployLambda(dir: string, name: string) : Function {
    // configure lambda function
    const lambda = new Function(this, name, {
      functionName: name,
      handler: `src/${name}/main`,
      runtime: Runtime.GO_1_X,
      code: Code.fromAsset(`${dir}${name}.zip`),
      memorySize: 512,
      timeout: Duration.seconds(10),
    });

    return lambda;
  }
}
